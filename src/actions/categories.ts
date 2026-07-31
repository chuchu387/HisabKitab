"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { categorySchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import type { ActionState } from "@/types";

export async function createCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("expensesManage");
    await connectToDatabase();
    const data = parseForm(categorySchema, formData);
    await ExpenseCategory.create({ ...data, organizationId, createdBy: session.user.userId });
    revalidatePath("/categories");
    return { ok: true, message: "Category created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCategory(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { organizationId } = await requireFeature("expensesManage");
    await connectToDatabase();
    const data = parseForm(categorySchema, formData);
    await ExpenseCategory.findOneAndUpdate({ _id: id, organizationId }, data, { runValidators: true });
    revalidatePath("/categories");
    return { ok: true, message: "Category updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteCategory(formData: FormData) {
  const { organizationId } = await requireFeature("expensesManage");
  await connectToDatabase();
  await ExpenseCategory.findOneAndDelete({ _id: String(formData.get("id")), organizationId });
  revalidatePath("/categories");
}
