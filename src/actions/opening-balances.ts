"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
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
    await OpeningBalance.create({ ...data, fiscalYearId: data.fiscalYearId || null, organizationId, createdBy: session.user.userId });
    revalidatePath("/opening-balances");
    revalidatePath("/ledger");
    revalidatePath("/accounts");
    return { ok: true, message: "Opening balance added" };
  } catch (error) {
    return actionError(error);
  }
}
