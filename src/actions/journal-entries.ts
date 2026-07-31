"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { ManualJournalEntry } from "@/models/ManualJournalEntry";
import { manualJournalSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { assertFiscalYearOpen } from "@/services/fiscal-years";
import { nextVoucherNumber } from "@/services/vouchers";
import type { ActionState } from "@/types";

export async function createManualJournal(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(manualJournalSchema, formData);
    await assertFiscalYearOpen(organizationId, data.entryDate);
    const voucherNumber = await nextVoucherNumber(ManualJournalEntry, organizationId, "journal", data.entryDate);
    await ManualJournalEntry.create({
      organizationId,
      voucherNumber,
      entryDate: data.entryDate,
      memo: data.memo,
      lines: [
        { accountCode: data.debitAccountCode, accountName: data.debitAccountName, debit: data.amount, credit: 0 },
        { accountCode: data.creditAccountCode, accountName: data.creditAccountName, debit: 0, credit: data.amount }
      ],
      createdBy: session.user.userId
    });
    revalidatePath("/journal-entries");
    revalidatePath("/ledger");
    revalidatePath("/accounts");
    return { ok: true, message: "Journal entry posted" };
  } catch (error) {
    return actionError(error);
  }
}
