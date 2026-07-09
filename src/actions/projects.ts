"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
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
    const project = await Project.create({ ...data, organizationId, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Created", entityType: "Project", entityId: project._id.toString(), metadata: { code: data.code } });
    revalidatePath("/projects");
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
    await Project.findOneAndUpdate({ _id: id, organizationId }, data, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Updated", entityType: "Project", entityId: id, metadata: { code: data.code } });
    revalidatePath("/projects");
    return { ok: true, message: "Project updated" };
  } catch (error) {
    return actionError(error);
  }
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
}
