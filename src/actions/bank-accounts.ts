"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { BankAccount } from "@/models/BankAccount";
import { bankAccountSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import type { ActionState } from "@/types";

export async function createBankAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("accountingView");
    await connectToDatabase();
    const data = parseForm(bankAccountSchema, formData);
    await BankAccount.create({ ...data, organizationId, createdBy: session.user.userId });
    revalidatePath("/bank-accounts");
    return { ok: true, message: "Bank account created" };
  } catch (error) {
    return actionError(error);
  }
}
