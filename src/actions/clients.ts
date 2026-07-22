"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";
import { clientSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createClient(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(clientSchema, formData);
    const client = await Client.create({ ...data, organizationId, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Client Created", entityType: "Client", entityId: client._id.toString(), metadata: { code: data.code } });
    revalidatePath("/clients");
    return { ok: true, message: "Client created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateClient(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(clientSchema, formData);
    const client = await Client.findOneAndUpdate({ _id: id, organizationId }, data, { runValidators: true });
    if (!client) throw new Error("Client not found");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Client Updated", entityType: "Client", entityId: id, metadata: { code: data.code } });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true, message: "Client updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deactivateClient(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  await Client.findOneAndUpdate({ _id: id, organizationId }, { active: false });
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Client Updated", entityType: "Client", entityId: id, metadata: { active: false } });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}
