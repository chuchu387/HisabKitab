"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { User } from "@/models/User";
import { userSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { notifyUserCreated } from "@/services/notifications";
import type { ActionState } from "@/types";

export async function createUser(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("usersManage");
    await connectToDatabase();
    const data = parseForm(userSchema.required({ password: true }), formData);
    const taskPermissions = taskPermissionsFrom(data);
    const user = await User.create({
      name: data.name,
      email: data.email,
      role: data.role,
      active: data.active,
      taskPermissions,
      devicePin: data.devicePin ?? "",
      organizationId,
      createdBy: session.user.userId,
      password: await bcrypt.hash(String(data.password), 12)
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Created", entityType: "User", entityId: user._id.toString(), metadata: { email: data.email, role: data.role } });
    await notifyUserCreated({ _id: user._id, organizationId, email: data.email, name: data.name, role: data.role, password: data.password }).catch(() => undefined);
    revalidatePath("/users");
    return { ok: true, message: "User created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUser(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("usersManage");
    await connectToDatabase();
    const data = parseForm(userSchema, formData);
    const update: Record<string, unknown> = { name: data.name, email: data.email, role: data.role, active: data.active, taskPermissions: taskPermissionsFrom(data), devicePin: data.devicePin ?? "" };
    if (data.password) update.password = await bcrypt.hash(data.password, 12);
    await User.findOneAndUpdate({ _id: id, organizationId }, update, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Updated", entityType: "User", entityId: id, metadata: { email: data.email, role: data.role } });
    revalidatePath("/users");
    return { ok: true, message: "User updated" };
  } catch (error) {
    return actionError(error);
  }
}

function taskPermissionsFrom(data: any) {
  return {
    canCreateTask: Boolean(data.canCreateTask),
    canAssignTask: Boolean(data.canAssignTask),
    canCreateFolder: Boolean(data.canCreateFolder),
    canManageFolderProjects: Boolean(data.canManageFolderProjects)
  };
}

export async function disableUser(formData: FormData) {
  const { session, organizationId } = await requireFeature("usersManage");
  await connectToDatabase();
  const id = String(formData.get("id"));
  await User.findOneAndUpdate({ _id: id, organizationId }, { active: false });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Updated", entityType: "User", entityId: id, metadata: { active: false } });
  revalidatePath("/users");
}

export async function updateUserPermissions(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("usersManage");
    await connectToDatabase();
    const userId = String(formData.get("userId"));
    if (userId === session.user.userId) throw new Error("Cannot edit your own permissions");
    const user = await User.findOne({ _id: userId, organizationId });
    if (!user) throw new Error("User not found");
    if (user.role === "owner" && session.user.role !== "owner") throw new Error("Only the owner can change permissions of another owner");
    const permissions: Record<string, boolean> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("perm_")) {
        permissions[key.replace("perm_", "")] = value === "true";
      }
    }
    user.permissions = permissions;
    await user.save();
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Permissions Updated", entityType: "User", entityId: userId });
    revalidatePath("/permissions");
    return { ok: true, message: "Permissions updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUserRole(userId: string, role: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireFeature("usersManage");
    await connectToDatabase();
    if (userId === session.user.userId) throw new Error("Cannot change your own role");
    if (!["staff", "admin", "owner"].includes(role)) throw new Error("Invalid role");
    if (session.user.role !== "owner" && role === "owner") throw new Error("Only the owner can promote to co-owner");
    if (session.user.role === "admin" && role === "owner") throw new Error("Only the owner can promote to co-owner");
    const user = await User.findOne({ _id: userId, organizationId });
    if (!user) throw new Error("User not found");
    if (user.role === "owner" && session.user.role !== "owner") throw new Error("Only the owner can change a co-owner's role");
    if (user.role === role) throw new Error("User already has this role");
    const oldRole = user.role;
    user.role = role;
    user.permissions = {};
    await user.save();
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Role Changed", entityType: "User", entityId: userId, metadata: { from: oldRole, to: role } });
    revalidatePath("/permissions");
    revalidatePath("/users");
    return { ok: true, message: "Role updated" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    return { ok: false, message };
  }
}
