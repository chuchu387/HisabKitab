"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";
import { TaskFolder } from "@/models/TaskFolder";
import { User } from "@/models/User";
import { actionError } from "@/actions/helpers";
import { taskFolderSchema } from "@/validations/schemas";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

const initialPermissions = {
  canCreateTask: true,
  canAssignTask: false,
  canCreateFolder: false,
  canManageFolderProjects: false
};

async function requireTaskPermission(permission: keyof typeof initialPermissions) {
  const { session, organizationId } = await requireTenant();
  if (session.user.role === "owner") return { session, organizationId };
  await connectToDatabase();
  const user = await User.findOne({ _id: session.user.userId, organizationId }).select("role taskPermissions").lean() as any;
  const fallback = user?.role === "admin" ? { ...initialPermissions, canAssignTask: true, canCreateFolder: true, canManageFolderProjects: true } : initialPermissions;
  const permissions = { ...fallback, ...(user?.taskPermissions ?? {}) };
  if (!permissions[permission]) throw new Error("You do not have permission for this task folder action");
  return { session, organizationId };
}

export async function createTaskFolder(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireFeature("salesTasks");
    const { session, organizationId } = await requireTaskPermission("canCreateFolder");
    await connectToDatabase();
    const data = parseTaskFolderForm(formData);
    await assertProjects(organizationId, data.projectIds);
    const folder = await TaskFolder.create({
      ...data,
      organizationId,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Task Folder Created", entityType: "TaskFolder", entityId: folder._id.toString(), metadata: { name: data.name, projectCount: data.projectIds.length } });
    revalidatePath("/tasks");
    return { ok: true, message: "Task folder created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateTaskFolder(folderId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireFeature("salesTasks");
    const { session, organizationId } = await requireTaskPermission("canManageFolderProjects");
    await connectToDatabase();
    const data = parseTaskFolderForm(formData);
    await assertProjects(organizationId, data.projectIds);
    const folder = await TaskFolder.findOneAndUpdate({ _id: folderId, organizationId }, data, { runValidators: true }).lean() as any;
    if (!folder) throw new Error("Task folder not found");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Task Folder Updated", entityType: "TaskFolder", entityId: folderId, metadata: { name: data.name, projectCount: data.projectIds.length } });
    revalidatePath("/tasks");
    return { ok: true, message: "Task folder updated" };
  } catch (error) {
    return actionError(error);
  }
}

function parseTaskFolderForm(formData: FormData) {
  return taskFolderSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    active: formData.get("active") === "on" || formData.get("active") === "true",
    projectIds: Array.from(new Set(formData.getAll("projectIds").map((value) => String(value)).filter(Boolean)))
  });
}

async function assertProjects(organizationId: string, projectIds: string[]) {
  if (!projectIds.length) return;
  const count = await Project.countDocuments({ _id: { $in: projectIds }, organizationId });
  if (count !== projectIds.length) throw new Error("One or more projects were not found");
}
