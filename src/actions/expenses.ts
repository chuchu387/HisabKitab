"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Expense } from "@/models/Expense";
import { expenseSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { saveReceipt, deleteReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

export async function createExpense(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin", "staff"]);
    await connectToDatabase();
    const data = parseForm(expenseSchema, formData);
    const receipt = formData.get("receipt");
    const receiptImageId = receipt instanceof File && receipt.size > 0 ? await saveReceipt(receipt, { organizationId, userId: session.user.userId }) : null;
    const expense = await Expense.create({
      ...data,
      organizationId,
      projectId: data.projectId || null,
      receiptImageId,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Created", entityType: "Expense", entityId: expense._id.toString(), metadata: { amount: data.amount } });
    revalidatePath("/expenses");
    return { ok: true, message: "Expense created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateExpense(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin", "staff"]);
    await connectToDatabase();
    const data = parseForm(expenseSchema, formData);
    const update: Record<string, unknown> = { ...data, projectId: data.projectId || null };
    const receipt = formData.get("receipt");
    if (receipt instanceof File && receipt.size > 0) update.receiptImageId = await saveReceipt(receipt, { organizationId, userId: session.user.userId });
    await Expense.findOneAndUpdate({ _id: id, organizationId }, update, { runValidators: true });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Updated", entityType: "Expense", entityId: id, metadata: { amount: data.amount } });
    revalidatePath("/expenses");
    return { ok: true, message: "Expense updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteExpense(formData: FormData) {
  const { session, organizationId } = await requireTenant();
  await requireRole(["owner", "admin", "staff"]);
  await connectToDatabase();
  const id = String(formData.get("id"));
  const expense = (await Expense.findOneAndDelete({ _id: id, organizationId }).lean()) as any;
  if (expense?.receiptImageId) await deleteReceipt(expense.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Deleted", entityType: "Expense", entityId: id });
  revalidatePath("/expenses");
}
