"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { Client } from "@/models/Client";
import { ProjectTask } from "@/models/ProjectTask";
import { ProjectPayment } from "@/models/ProjectPayment";
import { projectSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createProject(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(projectSchema, formData);
    await assertClientAccess(data.clientId, organizationId);
    const project = await Project.create({ ...data, clientId: data.clientId || null, organizationId, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Created", entityType: "Project", entityId: project._id.toString(), metadata: { code: data.code } });
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return { ok: true, message: "Project created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProject(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(projectSchema, formData);
    await assertClientAccess(data.clientId, organizationId);
    await Project.findOneAndUpdate({ _id: id, organizationId }, { ...data, clientId: data.clientId || null }, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Updated", entityType: "Project", entityId: id, metadata: { code: data.code } });
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath(`/projects/${id}`);
    return { ok: true, message: "Project updated" };
  } catch (error) {
    return actionError(error);
  }
}

async function assertClientAccess(clientId: string | null | undefined, organizationId: string) {
  if (!clientId) return;
  const client = await Client.exists({ _id: clientId, organizationId, active: true });
  if (!client) throw new Error("Client not found");
}

export async function deleteProject(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  await Project.findOneAndDelete({ _id: id, organizationId });
  await ProjectTask.deleteMany({ projectId: id, organizationId });
  await ProjectPayment.deleteMany({ projectId: id, organizationId });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Deleted", entityType: "Project", entityId: id });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
