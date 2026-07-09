"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { GeneralFund } from "@/models/GeneralFund";
import { actionError, parseForm } from "@/actions/helpers";
import { generalFundSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createGeneralFund(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(generalFundSchema, formData);
    const receipt = formData.get("receipt");
    const receiptImageId = receipt instanceof File && receipt.size > 0 ? await saveReceipt(receipt, { organizationId, entityType: "GeneralFund" }) : null;
    const fund = await GeneralFund.create({ ...data, organizationId, receiptImageId, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "General Fund Created", entityType: "GeneralFund", entityId: fund._id.toString(), metadata: { amount: data.amount } });
    revalidatePath("/general-funds");
    revalidatePath("/dashboard");
    return { ok: true, message: "General fund added" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteGeneralFund(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const fund = (await GeneralFund.findOneAndDelete({ _id: id, organizationId }).lean()) as any;
  if (!fund) throw new Error("Fund not found");
  if (fund.receiptImageId) await deleteReceipt(fund.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "General Fund Deleted", entityType: "GeneralFund", entityId: id, metadata: { amount: fund.amount } });
  revalidatePath("/general-funds");
  revalidatePath("/dashboard");
}
