"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { User } from "@/models/User";
import { userSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { notifyUserCreated } from "@/services/notifications";
import type { ActionState } from "@/types";

export async function createUser(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner"]);
    await connectToDatabase();
    const data = parseForm(userSchema.required({ password: true }), formData);
    const user = await User.create({
      ...data,
      organizationId,
      createdBy: session.user.userId,
      password: await bcrypt.hash(String(data.password), 12)
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Created", entityType: "User", entityId: user._id.toString(), metadata: { email: data.email, role: data.role } });
    await notifyUserCreated({ email: data.email, name: data.name, role: data.role, password: data.password }).catch(() => undefined);
    revalidatePath("/users");
    return { ok: true, message: "User created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUser(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner"]);
    await connectToDatabase();
    const data = parseForm(userSchema, formData);
    const update: Record<string, unknown> = { name: data.name, email: data.email, role: data.role, active: data.active };
    if (data.password) update.password = await bcrypt.hash(data.password, 12);
    await User.findOneAndUpdate({ _id: id, organizationId }, update, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Updated", entityType: "User", entityId: id, metadata: { email: data.email, role: data.role } });
    revalidatePath("/users");
    return { ok: true, message: "User updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function disableUser(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  await User.findOneAndUpdate({ _id: id, organizationId }, { active: false });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "User Updated", entityType: "User", entityId: id, metadata: { active: false } });
  revalidatePath("/users");
}
