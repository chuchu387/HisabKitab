"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Proposal } from "@/models/Proposal";
import { Lead } from "@/models/Lead";
import { LeadActivity } from "@/models/LeadActivity";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";
import { Invoice } from "@/models/Invoice";
import { Notification } from "@/models/Notification";
import { proposalSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createProposal(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(proposalSchema, formData);
    const proposal = await Proposal.create({
      ...data,
      leadId: data.leadId || null,
      organizationId,
      createdBy: session.user.userId
    });
    if (data.leadId) {
      await Lead.findOneAndUpdate({ _id: data.leadId, organizationId }, { status: "proposal_sent" });
      await LeadActivity.create({
        organizationId,
        leadId: data.leadId,
        userId: session.user.userId,
        type: "proposal_sent",
        description: `Proposal created: ${data.title} (Rs. ${data.amount})`,
        metadata: { proposalId: proposal._id.toString(), amount: data.amount }
      });
    }
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Proposal Created", entityType: "Proposal", entityId: proposal._id.toString(), metadata: { title: data.title } });
    revalidatePath("/sales/proposals");
    revalidatePath("/sales/reports");
    return { ok: true, message: "Proposal created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProposal(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(proposalSchema, formData);
    const proposal = await Proposal.findOneAndUpdate(
      { _id: id, organizationId },
      { ...data, leadId: data.leadId || null },
      { runValidators: true }
    );
    if (!proposal) throw new Error("Proposal not found");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Proposal Updated", entityType: "Proposal", entityId: id, metadata: { title: data.title } });
    revalidatePath("/sales/proposals");
    revalidatePath(`/sales/proposals/${id}`);
    return { ok: true, message: "Proposal updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function acceptProposal(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const createClient = formData.get("createClient") === "on";
  const clientCode = String(formData.get("clientCode") ?? "");
  const projectName = String(formData.get("projectName") ?? "");
  const projectCode = String(formData.get("projectCode") ?? "");
  const createInvoice = formData.get("createInvoice") === "on";
  const proposal = await Proposal.findOne({ _id: id, organizationId });
  if (!proposal) throw new Error("Proposal not found");
  proposal.status = "accepted";
  proposal.acceptedAt = new Date();
  if (createClient && clientCode) {
    const lead = proposal.leadId ? await Lead.findOne({ _id: proposal.leadId, organizationId }) : null;
    const client = await Client.create({
      organizationId,
      name: lead?.name ?? proposal.title,
      code: clientCode,
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      notes: `Created from proposal: ${proposal.title}`,
      createdBy: session.user.userId
    });
    proposal.convertedToClientId = client._id;
    if (lead) {
      lead.convertedToClientId = client._id;
      lead.status = "won";
      lead.convertedAt = new Date();
      await lead.save();
    }
    if (projectName && projectCode) {
      const project = await Project.create({
        organizationId,
        clientId: client._id,
        name: projectName,
        code: projectCode,
        totalBudget: proposal.amount,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        projectType: "client",
        createdBy: session.user.userId
      });
      proposal.convertedToProjectId = project._id;
      if (createInvoice) {
        const invoiceCount = await Invoice.countDocuments({ organizationId });
        const invoice = await Invoice.create({
          organizationId,
          clientId: client._id,
          projectId: project._id,
          invoiceNumber: `INV-${String(invoiceCount + 1).padStart(4, "0")}`,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          description: proposal.title,
          quantity: 1,
          rate: proposal.amount,
          status: "draft",
          createdBy: session.user.userId
        });
        proposal.convertedToInvoiceId = invoice._id;
      }
    }
  }
  proposal.convertedAt = new Date();
  await proposal.save();
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Proposal Accepted", entityType: "Proposal", entityId: id });
  revalidatePath("/sales/proposals");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  revalidatePath(`/sales/proposals/${id}`);
}

export async function deleteProposal(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  await Proposal.findOneAndDelete({ _id: id, organizationId });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Proposal Deleted", entityType: "Proposal", entityId: id });
  revalidatePath("/sales/proposals");
}

export async function sendProposal(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const proposal = await Proposal.findOneAndUpdate({ _id: id, organizationId }, { status: "sent", sentAt: new Date() }, { runValidators: true });
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.leadId) {
    await Lead.findOneAndUpdate({ _id: proposal.leadId, organizationId }, { status: "proposal_sent" });
    await LeadActivity.create({
      organizationId,
      leadId: proposal.leadId,
      userId: session.user.userId,
      type: "proposal_sent",
      description: `Proposal sent: ${proposal.title}`,
      metadata: { proposalId: proposal._id.toString() }
    });
  }
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Proposal Sent", entityType: "Proposal", entityId: id });
  revalidatePath("/sales/proposals");
  revalidatePath(`/sales/proposals/${id}`);
}
