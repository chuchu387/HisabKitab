"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { TaskFolder } from "@/models/TaskFolder";
import { User } from "@/models/User";
import { actionError, parseForm } from "@/actions/helpers";
import { projectTaskSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { appUrl } from "@/services/email";
import { notifyTaskAssigned } from "@/services/notifications";
import { sendDueTaskNotifications } from "@/services/task-due-notifications";
import type { ActionState } from "@/types";

async function assertProjectAccess(projectId: string, organizationId: string) {
  const project = await Project.exists({ _id: projectId, organizationId });
  if (!project) throw new Error("Project not found");
}

async function assertFolderProjectAccess(folderId: string | null | undefined, projectId: string, organizationId: string) {
  if (!folderId) return null;
  const folder = await TaskFolder.findOne({ _id: folderId, organizationId, active: true }).select("name projectIds").lean() as any;
  if (!folder) throw new Error("Task folder not found");
  const allowed = (folder.projectIds ?? []).map((id: any) => id.toString()).includes(projectId);
  if (!allowed) throw new Error("Selected project is not inside this task folder");
  return folderId;
}

async function currentTaskPermissions(organizationId: string, userId: string, role: string) {
  if (role === "owner") {
    return { canCreateTask: true, canAssignTask: true, canCreateFolder: true, canManageFolderProjects: true };
  }
  const fallback = role === "admin"
    ? { canCreateTask: true, canAssignTask: true, canCreateFolder: true, canManageFolderProjects: true }
    : { canCreateTask: true, canAssignTask: false, canCreateFolder: false, canManageFolderProjects: false };
  const user = await User.findOne({ _id: userId, organizationId }).select("taskPermissions").lean() as any;
  return { ...fallback, ...(user?.taskPermissions ?? {}) };
}

async function normalizeAssignees(formData: FormData, organizationId: string) {
  const ids = Array.from(new Set(formData.getAll("assigneeIds").map((value) => String(value)).filter(Boolean)));
  const legacyAssigneeId = String(formData.get("assigneeId") ?? "");
  if (!ids.length && legacyAssigneeId) ids.push(legacyAssigneeId);
  if (!ids.length) return { assigneeId: null, assigneeIds: [] };
  const users = await User.find({ _id: { $in: ids }, organizationId, active: true, role: { $in: ["owner", "admin", "staff"] } }).select("_id").lean();
  const validIds = new Set(users.map((user: any) => user._id.toString()));
  if (validIds.size !== ids.length) throw new Error("One or more assignees were not found");
  return { assigneeId: ids[0], assigneeIds: ids };
}

async function saveTaskFiles(formData: FormData, organizationId: string, projectId: string, taskId?: string) {
  const files = [
    ...formData.getAll("attachments"),
    ...formData.getAll("image")
  ].filter((value): value is File => value instanceof File && value.size > 0);
  const ids = [];
  for (const file of files.slice(0, 8)) {
    ids.push(await saveReceipt(file, { organizationId, projectId, taskId, entityType: "ProjectTask" }));
  }
  return ids;
}

function activity(userId: string, action: string, metadata: Record<string, unknown> = {}) {
  return { userId, action, metadata, createdAt: new Date() };
}

function taskManageQuery(taskId: string, projectId: string, organizationId: string, session: Awaited<ReturnType<typeof requireFeature>>["session"]) {
  const query: Record<string, unknown> = { _id: taskId, projectId, organizationId };
  if (session.user.role === "staff") {
    query.$or = [{ createdBy: session.user.userId }, { assigneeId: session.user.userId }, { assigneeIds: session.user.userId }];
  }
  return query;
}

const taskColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be123c", "#4f46e5", "#0f766e", "#a16207"];

function fallbackTaskColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 2147483647;
  return taskColors[Math.abs(hash) % taskColors.length];
}

function secondsBetween(from: Date | string | null | undefined, to = new Date()) {
  if (!from) return 0;
  const started = new Date(from).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((to.getTime() - started) / 1000));
}

export async function createProjectTask(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("projectsView");
    await connectToDatabase();
    const permissions = await currentTaskPermissions(organizationId, session.user.userId, session.user.role);
    if (!permissions.canCreateTask) throw new Error("You do not have permission to create tasks");
    await assertProjectAccess(projectId, organizationId);
    const data = parseForm(projectTaskSchema, formData);
    await assertFolderProjectAccess(data.folderId, projectId, organizationId);
    const assignees = permissions.canAssignTask ? await normalizeAssignees(formData, organizationId) : { assigneeId: session.user.userId, assigneeIds: [session.user.userId] };
    const attachmentIds = await saveTaskFiles(formData, organizationId, projectId);
    const task = await ProjectTask.create({
      ...data,
      ...assignees,
      color: data.color || fallbackTaskColor(`${data.title}-${Date.now()}`),
      organizationId,
      projectId,
      folderId: data.folderId || null,
      imageId: attachmentIds[0] ?? null,
      attachmentIds,
      activity: [activity(session.user.userId, "created", { status: data.status, priority: data.priority })],
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Created", entityType: "ProjectTask", entityId: task._id.toString(), metadata: { projectId, status: data.status } });
    await sendTaskAssignmentEmail(organizationId, projectId, task).catch(() => undefined);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    await sendDueTaskNotifications({ organizationId }).catch(() => undefined);
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
    const { session, organizationId } = await requireFeature("projectsView");
    await connectToDatabase();
    const permissions = await currentTaskPermissions(organizationId, session.user.userId, session.user.role);
    await assertProjectAccess(projectId, organizationId);
    const data = parseForm(projectTaskSchema, formData);
    await assertFolderProjectAccess(data.folderId, projectId, organizationId);
    const assignees = permissions.canAssignTask ? await normalizeAssignees(formData, organizationId) : null;
    const update: Record<string, unknown> = { ...data, folderId: data.folderId || null };
    if (assignees) Object.assign(update, assignees);
    if (!data.color) update.color = fallbackTaskColor(`${data.title}-${taskId}`);
    const attachmentIds = await saveTaskFiles(formData, organizationId, projectId, taskId);
    const updateCommand: Record<string, unknown> = {
      $set: update,
      $push: { activity: activity(session.user.userId, "updated", { status: data.status, priority: data.priority, severity: data.severity }) }
    };
    if (attachmentIds.length) {
      update.imageId = attachmentIds[0];
      updateCommand.$addToSet = { attachmentIds: { $each: attachmentIds } };
    }
    const updated = await ProjectTask.findOneAndUpdate(taskManageQuery(taskId, projectId, organizationId, session), updateCommand, { runValidators: true }).lean() as any;
    if (!updated) throw new Error("Task not found or not allowed");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Updated", entityType: "ProjectTask", entityId: taskId, metadata: { projectId, status: data.status } });
    const previousAssignees = new Set([updated.assigneeId?.toString?.(), ...(updated.assigneeIds ?? []).map((id: any) => id.toString())].filter(Boolean));
    const addedAssignees = assignees ? assignees.assigneeIds.filter((assigneeId) => !previousAssignees.has(assigneeId)) : [];
    if (addedAssignees.length) {
      await sendTaskAssignmentEmail(organizationId, projectId, { ...updated, ...data, assigneeId: assignees?.assigneeId, assigneeIds: addedAssignees }).catch(() => undefined);
    }
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    await sendDueTaskNotifications({ organizationId }).catch(() => undefined);
    return { ok: true, message: "Task updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveProjectTask(taskId: string, projectId: string, status: string): Promise<ActionState> {
  try {
    if (!projectTaskSchema.shape.status.safeParse(status).success) throw new Error("Invalid status");
    const { session, organizationId } = await requireFeature("projectsView");
    await connectToDatabase();
    await assertProjectAccess(projectId, organizationId);
    const now = new Date();
    const task = await ProjectTask.findOne(taskManageQuery(taskId, projectId, organizationId, session));
    if (!task) throw new Error("Task not found or not allowed");
    const update: Record<string, unknown> = { status };
    if (status === "in_progress" && task.timerStatus !== "running") {
      update.timerStatus = "running";
      update.startedAt = task.startedAt ?? now;
      update.lastTimerStartedAt = now;
      update.completedAt = null;
    }
    if (status !== "in_progress" && status !== "complete" && task.timerStatus === "running") {
      update.timerStatus = "paused";
      update.lastTimerStartedAt = null;
      update.accumulatedSeconds = Number(task.accumulatedSeconds ?? 0) + secondsBetween(task.lastTimerStartedAt, now);
    }
    if (status === "complete") {
      update.timerStatus = "stopped";
      update.completedAt = task.completedAt ?? now;
      update.lastTimerStartedAt = null;
      update.accumulatedSeconds = Number(task.accumulatedSeconds ?? 0) + (task.timerStatus === "running" ? secondsBetween(task.lastTimerStartedAt, now) : 0);
    }
    await ProjectTask.updateOne({ _id: task._id }, { $set: update, $push: { activity: activity(session.user.userId, "moved", { status }) } }, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Status Updated", entityType: "ProjectTask", entityId: taskId, metadata: { projectId, status } });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    await sendDueTaskNotifications({ organizationId }).catch(() => undefined);
    return { ok: true, message: "Task moved" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProjectTaskTimer(taskId: string, projectId: string, command: "start" | "pause" | "stop"): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("projectsView");
    await connectToDatabase();
    await assertProjectAccess(projectId, organizationId);
    const now = new Date();
    const task = await ProjectTask.findOne(taskManageQuery(taskId, projectId, organizationId, session));
    if (!task) throw new Error("Task not found or not allowed");
    const accumulated = Number(task.accumulatedSeconds ?? 0);
    const runningSeconds = task.timerStatus === "running" ? secondsBetween(task.lastTimerStartedAt, now) : 0;
    const update: Record<string, unknown> = {};

    if (command === "start") {
      update.timerStatus = "running";
      update.startedAt = task.startedAt ?? now;
      update.lastTimerStartedAt = now;
      update.completedAt = null;
      if (task.status === "to_do") update.status = "in_progress";
    }
    if (command === "pause") {
      if (session.user.role === "staff") throw new Error("Move the task to another status to stop staff time tracking");
      update.timerStatus = "paused";
      update.accumulatedSeconds = accumulated + runningSeconds;
      update.lastTimerStartedAt = null;
    }
    if (command === "stop") {
      update.timerStatus = "stopped";
      update.status = "complete";
      update.completedAt = now;
      update.accumulatedSeconds = accumulated + runningSeconds;
      update.lastTimerStartedAt = null;
    }

    await ProjectTask.updateOne({ _id: task._id }, { $set: update, $push: { activity: activity(session.user.userId, `timer_${command}`) } }, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: `Project Task Timer ${command}`, entityType: "ProjectTask", entityId: taskId, metadata: { projectId } });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    await sendDueTaskNotifications({ organizationId }).catch(() => undefined);
    return { ok: true, message: command === "start" ? "Timer started" : command === "pause" ? "Timer paused" : "Task completed" };
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkStartProjectTasks(taskIds: string[]): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("projectsView");
    await connectToDatabase();
    const ids = Array.from(new Set(taskIds.filter(Boolean)));
    if (!ids.length) throw new Error("Select at least one task");
    const now = new Date();
    const tasks = await ProjectTask.find({ _id: { $in: ids }, organizationId, status: { $ne: "complete" } }).select("_id projectId startedAt").lean() as any[];
    if (tasks.length) {
      await ProjectTask.bulkWrite(tasks.map((task) => ({
        updateOne: {
          filter: { _id: task._id, organizationId },
          update: {
            $set: { status: "in_progress", timerStatus: "running", startedAt: task.startedAt ?? now, lastTimerStartedAt: now, completedAt: null },
            $push: { activity: activity(session.user.userId, "bulk_timer_start") }
          },
          runValidators: true
        }
      })) as any);
    }
    const projectIds = Array.from(new Set(tasks.map((task) => task.projectId?.toString?.()).filter(Boolean)));
    projectIds.forEach((id) => revalidatePath(`/projects/${id}`));
    revalidatePath("/tasks");
    await sendDueTaskNotifications({ organizationId }).catch(() => undefined);
    return { ok: true, message: `Started ${tasks.length} task timers` };
  } catch (error) {
    return actionError(error);
  }
}

export async function addProjectTaskComment(taskId: string, projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("projectsView");
    await connectToDatabase();
    await assertProjectAccess(projectId, organizationId);
    const message = String(formData.get("message") ?? "").trim();
    if (message.length < 2) throw new Error("Comment must be at least 2 characters");
    if (message.length > 1000) throw new Error("Comment must be 1000 characters or less");
    const updated = await ProjectTask.findOneAndUpdate(
      taskManageQuery(taskId, projectId, organizationId, session),
      {
        $push: {
          comments: { userId: session.user.userId, message, createdAt: new Date() },
          activity: activity(session.user.userId, "commented")
        }
      },
      { runValidators: true }
    ).lean();
    if (!updated) throw new Error("Task not found or not allowed");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { ok: true, message: "Comment added" };
  } catch (error) {
    return actionError(error);
  }
}

async function sendTaskAssignmentEmail(organizationId: string, projectId: string, task: any) {
  const assigneeIds = Array.from(new Set([task.assigneeId?.toString?.(), ...(task.assigneeIds ?? []).map((id: any) => id.toString())].filter(Boolean)));
  if (!assigneeIds.length) return;
  const [assignee, project] = await Promise.all([
    User.find({ _id: { $in: assigneeIds }, organizationId }).select("name email").lean(),
    Project.findOne({ _id: projectId, organizationId }).select("name").lean() as any
  ]);
  await Promise.all((assignee as any[]).map((user) => {
    if (!user.email) return Promise.resolve();
    return notifyTaskAssigned({ ...user, organizationId }, {
      title: task.title,
      status: task.status,
      projectName: project?.name,
      taskUrl: appUrl(`/projects/${projectId}`)
    });
  }));
}

export async function deleteProjectTask(formData: FormData) {
  const { session, organizationId } = await requireFeature("projectsView");
  await connectToDatabase();
  const taskId = String(formData.get("taskId"));
  const projectId = String(formData.get("projectId"));
  const task = (await ProjectTask.findOneAndDelete(taskManageQuery(taskId, projectId, organizationId, session)).lean()) as any;
  if (!task) throw new Error("Task not found or not allowed");
  if (task?.imageId) await deleteReceipt(task.imageId.toString()).catch(() => undefined);
  for (const id of task?.attachmentIds ?? []) await deleteReceipt(id.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Project Task Deleted", entityType: "ProjectTask", entityId: taskId, metadata: { projectId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tasks");
}
