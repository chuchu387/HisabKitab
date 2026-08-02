"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Lead } from "@/models/Lead";
import { LeadActivity } from "@/models/LeadActivity";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { Product } from "@/models/Product";
import { Notification } from "@/models/Notification";
import { User } from "@/models/User";
import { leadSchema, leadStatusUpdateSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

function computeLeadScore(data: any) {
  let score = 0;
  if (data.email) score += 25;
  if (data.phone) score += 20;
  if (data.company) score += 10;
  if (data.estimatedValue && data.estimatedValue > 0) score += 15;
  if (data.source && data.source !== "referral") score += 10;
  if (data.notes && data.notes.length > 20) score += 5;
  return score;
}

async function checkDuplicate(organizationId: string, email: string, phone: string, excludeId?: string) {
  const or: Record<string, unknown>[] = [];
  if (email) or.push({ email, organizationId });
  if (phone) or.push({ phone, organizationId });
  if (!or.length) return null;
  const filter: Record<string, unknown> = { $or: or };
  if (excludeId) filter._id = { $ne: excludeId };
  const existingLead = await Lead.findOne(filter).select("name email phone").lean();
  if (existingLead) return { type: "lead", name: (existingLead as any).name };
  const existingClient = await Client.findOne(filter).select("name email phone").lean();
  if (existingClient) return { type: "client", name: (existingClient as any).name };
  return null;
}

async function scheduleFollowUpNotification(organizationId: string, userId: string, leadId: string, leadName: string, followUpDate: Date | null) {
  if (!followUpDate || !userId) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const followDate = new Date(followUpDate);
  followDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((followDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays <= 1) {
    await Notification.create({
      organizationId,
      userId,
      title: "Follow-up reminder",
      message: `${leadName} has a follow-up scheduled for ${followDate.toLocaleDateString()}.`,
      href: `/leads/${leadId}`,
      type: "lead"
    }).catch(() => undefined);
  }
}

export async function createLead(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const data = parseForm(leadSchema, formData);
    const duplicate = await checkDuplicate(organizationId, data.email || "", data.phone || "");
    if (duplicate) throw new Error(`A ${duplicate.type} already exists with this contact: ${duplicate.name}`);
    const lead = await Lead.create({
      ...data,
      assignedTo: data.assignedTo || null,
      campaignId: data.campaignId || null,
      projectId: data.projectId || null,
      productId: data.productId || null,
      followUpDate: data.followUpDate || null,
      score: computeLeadScore(data),
      organizationId,
      createdBy: session.user.userId
    });
    await LeadActivity.create({
      organizationId,
      leadId: lead._id,
      userId: session.user.userId,
      type: "note",
      description: "Lead created"
    });
    await scheduleFollowUpNotification(organizationId, String(data.assignedTo || session.user.userId), lead._id.toString(), data.name, data.followUpDate as Date | null);
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Created", entityType: "Lead", entityId: lead._id.toString(), metadata: { name: data.name } });
    revalidatePath("/leads");
    revalidatePath("/sales/reports");
    return { ok: true, message: "Lead created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLead(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const data = parseForm(leadSchema, formData);
    const duplicate = await checkDuplicate(organizationId, data.email || "", data.phone || "", id);
    if (duplicate) throw new Error(`A ${duplicate.type} already exists with this contact: ${duplicate.name}`);
    const lead = await Lead.findOneAndUpdate(
      { _id: id, organizationId },
      { ...data, assignedTo: data.assignedTo || null, campaignId: data.campaignId || null, projectId: data.projectId || null, productId: data.productId || null, followUpDate: data.followUpDate || null },
      { runValidators: true }
    );
    if (!lead) throw new Error("Lead not found");
    await scheduleFollowUpNotification(organizationId, String(data.assignedTo || session.user.userId), id, data.name, data.followUpDate as Date | null);
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Updated", entityType: "Lead", entityId: id, metadata: { name: data.name } });
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    revalidatePath("/sales/reports");
    return { ok: true, message: "Lead updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteLead(formData: FormData) {
  const { session, organizationId } = await requireFeature("leadsManage");
  await connectToDatabase();
  const id = String(formData.get("id"));
  await Lead.findOneAndDelete({ _id: id, organizationId });
  await LeadActivity.deleteMany({ leadId: id, organizationId });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Deleted", entityType: "Lead", entityId: id });
  revalidatePath("/leads");
  revalidatePath("/sales/reports");
}

export async function bulkDeleteLeads(ids: string[]): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (!objectIds.length) throw new Error("No valid leads selected");
    const leads = await Lead.find({ _id: { $in: objectIds }, organizationId }).select("_id").lean() as { _id: Types.ObjectId }[];
    if (!leads.length) throw new Error("Leads not found");
    await Lead.deleteMany({ _id: { $in: leads.map((lead) => lead._id) }, organizationId });
    await LeadActivity.deleteMany({ leadId: { $in: leads.map((lead) => lead._id) }, organizationId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Leads Bulk Deleted", entityType: "Lead", entityId: leads[0]._id.toString(), metadata: { count: leads.length, leadIds: leads.map((lead) => lead._id.toString()) } });
    revalidatePath("/leads");
    revalidatePath("/sales/pipeline");
    revalidatePath("/sales/reports");
    return { ok: true, message: `${leads.length} leads deleted` };
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkAssignLeads(ids: string[], assigneeId: string): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const objectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (!objectIds.length) throw new Error("No valid leads selected");
    let assignedUserId: Types.ObjectId | null = null;
    let assigneeName = "Unassigned";
    if (assigneeId) {
      if (!Types.ObjectId.isValid(assigneeId)) throw new Error("Invalid assignee");
      const assignee = await User.findOne({ _id: assigneeId, organizationId, active: true, role: { $in: ["owner", "admin", "staff"] } }).select("_id name").lean();
      if (!assignee) throw new Error("Assignee not found or inactive");
      assignedUserId = new Types.ObjectId(assigneeId);
      assigneeName = (assignee as any).name ?? "Selected user";
    }
    const result = await Lead.updateMany({ _id: { $in: objectIds }, organizationId }, { $set: { assignedTo: assignedUserId } });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Leads Bulk Assigned", entityType: "Lead", entityId: objectIds[0].toString(), metadata: { count: result.modifiedCount, assigneeId: assignedUserId?.toString() ?? null, leadIds: objectIds.map((id) => id.toString()) } });
    revalidatePath("/leads");
    revalidatePath("/sales/pipeline");
    revalidatePath("/sales/reports");
    return { ok: true, message: assignedUserId ? `${result.modifiedCount} leads assigned to ${assigneeName}` : `${result.modifiedCount} leads unassigned` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLeadStatus(id: string, status: string) {
  const { session, organizationId } = await requireFeature("leadsManage");
  await connectToDatabase();
  const parsed = leadStatusUpdateSchema.safeParse({ status });
  if (!parsed.success) throw new Error("Invalid status");
  const lead = await Lead.findOne({ _id: id, organizationId });
  if (!lead) throw new Error("Lead not found");
  const oldStatus = lead.status;
  lead.status = parsed.data.status;
  if (parsed.data.status === "won" || parsed.data.status === "lost") {
    lead.convertedAt = new Date();
  }
  await lead.save();
  await LeadActivity.create({
    organizationId,
    leadId: id,
    userId: session.user.userId,
    type: "status_changed",
    description: `Status changed from ${oldStatus} to ${parsed.data.status}`,
    metadata: { from: oldStatus, to: parsed.data.status }
  });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Status Updated", entityType: "Lead", entityId: id, metadata: { from: oldStatus, to: parsed.data.status } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/sales/pipeline");
  revalidatePath("/sales/reports");
}

export async function convertLeadToClient(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const leadId = String(formData.get("leadId"));
    const clientCode = String(formData.get("clientCode"));
    const projectName = String(formData.get("projectName") ?? "");
    const projectCode = String(formData.get("projectCode") ?? "");
    const budget = parseFloat(String(formData.get("budget") ?? "0"));
    const lead = await Lead.findOne({ _id: leadId, organizationId });
    if (!lead) throw new Error("Lead not found");
    const client = await Client.create({
      organizationId,
      name: lead.name,
      code: clientCode,
      email: lead.email,
      phone: lead.phone,
      notes: `Converted from lead. Original notes: ${lead.notes}`,
      createdBy: session.user.userId
    });
    lead.convertedToClientId = client._id;
    lead.status = "won";
    lead.convertedAt = new Date();
    await lead.save();
    let project = null;
    if (projectName && projectCode) {
      project = await Project.create({
        organizationId,
        clientId: client._id,
        name: projectName,
        code: projectCode,
        totalBudget: budget || 0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        projectType: "client",
        createdBy: session.user.userId
      });
      lead.convertedToProjectId = project._id;
      await lead.save();
    }
    await LeadActivity.create({
      organizationId,
      leadId: leadId,
      userId: session.user.userId,
      type: "converted",
      description: `Lead converted to client ${client.name}${project ? ` and project ${project.name}` : ""}`,
      metadata: { clientId: client._id.toString(), projectId: project?._id?.toString() }
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Converted", entityType: "Lead", entityId: leadId, metadata: { clientId: client._id.toString() } });
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/sales/reports");
    revalidatePath("/clients");
    if (project) revalidatePath("/projects");
    return { ok: true, message: "Lead converted to client successfully" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed";
    return { ok: false, message };
  }
}

export async function addLeadActivity(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const leadId = String(formData.get("leadId"));
    const type = String(formData.get("type"));
    const description = String(formData.get("description") ?? "").trim();
    if (!leadId || !type) throw new Error("Lead ID and type are required");
    if (description.length < 2) throw new Error("Description must be at least 2 characters");
    const lead = await Lead.findOne({ _id: leadId, organizationId });
    if (!lead) throw new Error("Lead not found");
    await LeadActivity.create({
      organizationId,
      leadId,
      userId: session.user.userId,
      type,
      description,
      metadata: {}
    });
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: "Activity added" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLeadFollowUp(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const followUpDate = formData.get("followUpDate") ? new Date(String(formData.get("followUpDate"))) : null;
    const lead = await Lead.findOne({ _id: id, organizationId });
    if (!lead) throw new Error("Lead not found");
    await Lead.findOneAndUpdate({ _id: id, organizationId }, { followUpDate });
    await scheduleFollowUpNotification(organizationId, String(lead.assignedTo || session.user.userId), id, lead.name, followUpDate);
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { ok: true, message: "Follow-up date updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function importLeadsCsv(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireFeature("leadsManage");
    await connectToDatabase();
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("CSV file is required");
    const text = await file.text();
    const Papa = await import("papaparse");
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
    if (!parsed.data.length) throw new Error("CSV file is empty");
    const rows = parsed.data as Record<string, string>[];
    function cell(row: Record<string, string>, ...variants: string[]) {
      for (const v of variants) {
        const val = row[v];
        if (val != null) return String(val);
      }
      return "";
    }
    const [projects, products] = await Promise.all([
      Project.find({ organizationId }).select("name code").lean(),
      Product.find({ organizationId, active: true }).select("name category").lean()
    ]);
    const normalize = (value: string) => value.trim().toLowerCase();
    const projectLookup = new Map<string, string>();
    projects.forEach((project: any) => {
      if (project.name) projectLookup.set(normalize(project.name), project._id.toString());
      if (project.code) projectLookup.set(normalize(project.code), project._id.toString());
    });
    const productLookup = new Map<string, string>();
    products.forEach((product: any) => {
      if (product.name) productLookup.set(normalize(product.name), product._id.toString());
      if (product.category) productLookup.set(normalize(`${product.name} ${product.category}`), product._id.toString());
    });
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const name = cell(row, "name", "Name", "Lead Name").trim();
      if (!name) { skipped += 1; continue; }
      const email = cell(row, "email", "Email").toLowerCase().trim();
      const phone = cell(row, "phone", "Phone");
      const dup = await checkDuplicate(organizationId, email, phone);
      if (dup) { skipped += 1; continue; }
      const company = cell(row, "company", "Company");
      const source = cell(row, "source", "Source").toLowerCase().trim();
      const projectKey = normalize(cell(row, "project", "Project", "Project Code", "projectCode", "project_code"));
      const productKey = normalize(cell(row, "product", "Product", "service", "Service", "Product / Service"));
      const validSources = ["website", "referral", "facebook", "instagram", "linkedin", "cold_call", "existing_client", "walk_in", "other"];
      const finalSource = validSources.includes(source) ? source : "referral";
      await Lead.create({
        organizationId,
        name,
        email,
        phone,
        company,
        source: finalSource,
        projectId: projectLookup.get(projectKey) || null,
        productId: productLookup.get(productKey) || null,
        estimatedValue: parseFloat(cell(row, "estimatedValue", "Estimated Value", "estimated_value", "value")) || 0,
        notes: cell(row, "notes", "Notes"),
        createdBy: session.user.userId
      });
      created += 1;
    }
    revalidatePath("/leads");
    revalidatePath("/sales/reports");
    return { ok: true, message: `${created} leads imported, ${skipped} skipped` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return { ok: false, message };
  }
}
