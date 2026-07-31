"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { GeneralFund } from "@/models/GeneralFund";
import { actionError, parseForm } from "@/actions/helpers";
import { generalFundSchema } from "@/validations/schemas";
import { deleteReceipt, saveReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import { nextVoucherNumber } from "@/services/vouchers";
import type { ActionState } from "@/types";

export async function createGeneralFund(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("generalFunds");
    await connectToDatabase();
    const data = parseForm(generalFundSchema, formData);
    await assertFiscalYearOpen(organizationId, data.fundDate);
    const receipt = formData.get("receipt");
    const receiptImageId = receipt instanceof File && receipt.size > 0 ? await saveReceipt(receipt, { organizationId, entityType: "GeneralFund" }) : null;
    const voucherNumber = await nextVoucherNumber(GeneralFund, organizationId, "generalFund", data.fundDate);
    const fund = await GeneralFund.create({ ...data, voucherNumber, bankAccountId: data.bankAccountId || null, organizationId, receiptImageId, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "General Fund Created", entityType: "GeneralFund", entityId: fund._id.toString(), metadata: { amount: data.amount, voucherNumber } });
    revalidatePath("/general-funds");
    revalidatePath("/dashboard");
    return { ok: true, message: "General fund added" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteGeneralFund(formData: FormData) {
  const { session, organizationId } = await requireFeature("generalFunds");
  await connectToDatabase();
  const id = String(formData.get("id"));
  const fund = (await GeneralFund.findOne({ _id: id, organizationId }).lean()) as any;
  if (!fund) throw new Error("Fund not found");
  await assertFiscalYearOpen(organizationId, fund.fundDate);
  await GeneralFund.deleteOne({ _id: id, organizationId });
  if (fund.receiptImageId) await deleteReceipt(fund.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "General Fund Deleted", entityType: "GeneralFund", entityId: id, metadata: { amount: fund.amount } });
  revalidatePath("/general-funds");
  revalidatePath("/dashboard");
}
