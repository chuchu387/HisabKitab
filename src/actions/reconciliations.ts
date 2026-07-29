"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { BankAccount } from "@/models/BankAccount";
import { BankReconciliation } from "@/models/BankReconciliation";
import { actionError, parseForm } from "@/actions/helpers";
import { getBankSystemBalances } from "@/services/reconciliation";
import { nextVoucherNumber } from "@/services/vouchers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

const reconciliationSchema = z.object({
  bankAccountId: z.string().min(1, "Account is required"),
  statementDate: z.coerce.date(),
  statementBalance: z.coerce.number(),
  note: z.string().optional().default("")
});

export async function createBankReconciliation(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const data = parseForm(reconciliationSchema, formData);
    const account = await BankAccount.findOne({ _id: data.bankAccountId, organizationId }).select("name").lean();
    if (!account) throw new Error("Bank account not found");
    const balances = await getBankSystemBalances(organizationId, data.statementDate);
    const systemBalance = balances.find((item) => item.bankAccountId === data.bankAccountId)?.balance ?? 0;
    const difference = round(systemBalance - data.statementBalance);
    const voucherNumber = await nextVoucherNumber(BankReconciliation, organizationId, "reconciliation", data.statementDate);
    const reconciliation = await BankReconciliation.create({
      organizationId,
      voucherNumber,
      bankAccountId: data.bankAccountId,
      statementDate: data.statementDate,
      systemBalance,
      statementBalance: data.statementBalance,
      difference,
      note: data.note,
      createdBy: session.user.userId
    });
    await writeAuditLog({
      organizationId,
      userId: session.user.userId,
      action: "Bank Reconciliation Created",
      entityType: "BankReconciliation",
      entityId: reconciliation._id.toString(),
      metadata: { voucherNumber, bankAccountId: data.bankAccountId, systemBalance, statementBalance: data.statementBalance, difference }
    });
    revalidatePath("/reconciliation");
    return { ok: true, message: difference === 0 ? "Reconciliation saved and matched" : "Reconciliation saved with difference" };
  } catch (error) {
    return actionError(error);
  }
}

function round(value: number) {
  return Number(value.toFixed(2));
}
