"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { BankAccount } from "@/models/BankAccount";
import { OpeningBalance } from "@/models/OpeningBalance";
import { openingBalanceSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import type { ActionState } from "@/types";

export async function createOpeningBalance(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner"]);
    await connectToDatabase();
    const data = parseForm(openingBalanceSchema, formData);
    const looksLikeCashOpening = data.accountCode.trim() === "1000" || /cash|bank|wallet/i.test(data.accountName);
    if (looksLikeCashOpening) {
      const bankOpeningCount = await BankAccount.countDocuments({ organizationId, openingBalance: { $ne: 0 } });
      if (bankOpeningCount > 0) {
        throw new Error("Cash/bank opening is already managed from Bank Accounts. Do not add the same opening cash again here.");
      }
    }
    await OpeningBalance.create({ ...data, fiscalYearId: data.fiscalYearId || null, organizationId, createdBy: session.user.userId });
    revalidatePath("/opening-balances");
    revalidatePath("/ledger");
    revalidatePath("/accounts");
    return { ok: true, message: "Opening balance added" };
  } catch (error) {
    return actionError(error);
  }
}
