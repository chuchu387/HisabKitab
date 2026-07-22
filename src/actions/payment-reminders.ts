"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { sendPaymentDueReminders } from "@/services/payment-reminders";
import { actionError } from "@/actions/helpers";
import type { ActionState } from "@/types";

export async function runPaymentDueReminders(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId, session } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const force = formData.get("force") === "on";
    const result = await sendPaymentDueReminders({ organizationId, triggeredBy: session.user.userId, force });
    revalidatePath("/payment-reminders");
    revalidatePath("/email-logs");
    revalidatePath("/notifications");
    return { ok: true, message: `Reminders complete: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped` };
  } catch (error) {
    return actionError(error);
  }
}
