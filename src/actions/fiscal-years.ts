"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { FiscalYear } from "@/models/FiscalYear";
import { fiscalYearSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import type { ActionState } from "@/types";

export async function createFiscalYear(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId } = await requireTenant();
    await requireRole(["owner"]);
    await connectToDatabase();
    const data = parseForm(fiscalYearSchema, formData);
    await FiscalYear.create({ ...data, organizationId });
    revalidatePath("/fiscal-years");
    return { ok: true, message: "Fiscal year created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleFiscalYearStatus(formData: FormData) {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) === "closed" ? "closed" : "open";
  await FiscalYear.findOneAndUpdate({ _id: id, organizationId }, { status, closedBy: status === "closed" ? session.user.userId : null, closedAt: status === "closed" ? new Date() : null });
  revalidatePath("/fiscal-years");
}
