"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";
import { actionError, parseForm } from "@/actions/helpers";
import { projectTaskSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { appUrl } from "@/services/email";
import { notifyTaskAssigned } from "@/services/notifications";
import type { ActionState } from "@/types";

async function assertProjectAccess(projectId: string, organizationId: string) {
  const project = await Project.exists({ _id: projectId, organizationId });
  if (!project) throw new Error("Project not found");
}

async function normalizeAssignee(assigneeId: string | null | undefined, organizationId: string) {
  if (!assigneeId) return null;
  const user = await User.exists({ _id: assigneeId, organizationId, active: true, role: { $in: ["admin", "staff"] } });
  if (!user) throw new Error("Assignee not found");
  return assigneeId;
}

function taskManageQuery(taskId: string, projectId: string, organizationId: string, session: Awaited<ReturnType<typeof requireTenant>>["session"]) {
  const query: Record<string, unknown> = { _id: taskId, projectId, organizationId };
  if (session.user.role === "staff") {
    query.$or = [{ createdBy: session.user.userId }, { assigneeId: session.user.userId }];
  }
  return query;
}

export async function createProjectTask(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin", "staff"]);
    await connectToDatabase();
    await assertProjectAccess(projectId, organizationId);
    const data = parseForm(projectTaskSchema, formData);
    const image = formData.get("image");
    const imageId = image instanceof File && image.size > 0 ? await saveReceipt(image, { organizationId, projectId, entityType: "ProjectTask" }) : null;
    const task = await ProjectTask.create({
      ...data,
      assigneeId: await normalizeAssignee(data.assigneeId, organizationId),
      organizationId,
      projectId,
      imageId,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Created", entityType: "ProjectTask", entityId: task._id.toString(), metadata: { projectId, status: data.status } });
    await sendTaskAssignmentEmail(organizationId, projectId, task).catch(() => undefined);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { ok: true, message: "Task created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function createGlobalProjectTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { ok: false, message: "Select a project" };
  return createProjectTask(projectId, _, formData);
}

export async function updateProjectTask(taskId: string, projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin", "staff"]);
    await connectToDatabase();
    await assertProjectAccess(projectId, organizationId);
    const data = parseForm(projectTaskSchema, formData);
    const update: Record<string, unknown> = { ...data, assigneeId: await normalizeAssignee(data.assigneeId, organizationId) };
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) update.imageId = await saveReceipt(image, { organizationId, projectId, taskId, entityType: "ProjectTask" });
    const updated = await ProjectTask.findOneAndUpdate(taskManageQuery(taskId, projectId, organizationId, session), update, { runValidators: true }).lean() as any;
    if (!updated) throw new Error("Task not found or not allowed");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Updated", entityType: "ProjectTask", entityId: taskId, metadata: { projectId, status: data.status } });
    const previousAssignee = updated.assigneeId?.toString?.() ?? "";
    if (data.assigneeId && previousAssignee !== data.assigneeId) {
      await sendTaskAssignmentEmail(organizationId, projectId, { ...updated, ...data, assigneeId: data.assigneeId }).catch(() => undefined);
    }
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { ok: true, message: "Task updated" };
  } catch (error) {
    return actionError(error);
  }
}

async function sendTaskAssignmentEmail(organizationId: string, projectId: string, task: any) {
  if (!task.assigneeId) return;
  const [assignee, project] = await Promise.all([
    User.findOne({ _id: task.assigneeId, organizationId }).select("name email").lean() as any,
    Project.findOne({ _id: projectId, organizationId }).select("name").lean() as any
  ]);
  if (!assignee?.email) return;
  await notifyTaskAssigned({ ...assignee, organizationId }, {
    title: task.title,
    status: task.status,
    projectName: project?.name,
    taskUrl: appUrl(`/projects/${projectId}`)
  });
}

export async function deleteProjectTask(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin", "staff"]);
  await connectToDatabase();
  const taskId = String(formData.get("taskId"));
  const projectId = String(formData.get("projectId"));
  const task = (await ProjectTask.findOneAndDelete(taskManageQuery(taskId, projectId, organizationId, session)).lean()) as any;
  if (!task) throw new Error("Task not found or not allowed");
  if (task?.imageId) await deleteReceipt(task.imageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Deleted", entityType: "ProjectTask", entityId: taskId, metadata: { projectId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tasks");
}
