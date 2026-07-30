"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { LeadTask } from "@/models/LeadTask";
import { Lead } from "@/models/Lead";
import { leadTaskSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createLeadTask(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin", "staff"]);
    await connectToDatabase();
    const data = parseForm(leadTaskSchema, formData);
    if (data.leadId) {
      const lead = await Lead.findOne({ _id: data.leadId, organizationId });
      if (!lead) throw new Error("Lead not found");
    }
    const task = await LeadTask.create({
      ...data,
      leadId: data.leadId || null,
      assigneeId: data.assigneeId || null,
      dueDate: data.dueDate || null,
      organizationId,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Task Created", entityType: "LeadTask", entityId: task._id.toString(), metadata: { title: data.title } });
    revalidatePath("/sales/tasks");
    if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
    return { ok: true, message: "Task created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLeadTask(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(leadTaskSchema, formData);
    const task = await LeadTask.findOneAndUpdate(
      { _id: id, organizationId },
      { ...data, leadId: data.leadId || null, assigneeId: data.assigneeId || null, dueDate: data.dueDate || null },
      { runValidators: true }
    );
    if (!task) throw new Error("Task not found");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Task Updated", entityType: "LeadTask", entityId: id, metadata: { title: data.title } });
    revalidatePath("/sales/tasks");
    if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
    return { ok: true, message: "Task updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLeadTaskStatus(id: string, status: string) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin", "staff"]);
  await connectToDatabase();
  const update: any = { status };
  if (status === "closed") update.completedAt = new Date();
  const task = await LeadTask.findOneAndUpdate({ _id: id, organizationId }, update, { runValidators: true });
  if (!task) throw new Error("Task not found");
  revalidatePath("/sales/tasks");
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
}

export async function deleteLeadTask(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const task = await LeadTask.findOneAndDelete({ _id: id, organizationId });
  if (!task) throw new Error("Task not found");
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Lead Task Deleted", entityType: "LeadTask", entityId: id });
  revalidatePath("/sales/tasks");
  if (task.leadId) revalidatePath(`/leads/${task.leadId}`);
}
