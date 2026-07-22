"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";
import { expenseSchema } from "@/validations/schemas";
import { expenseApprovalSchema } from "@/validations/schemas";
import { actionError, parseForm } from "@/actions/helpers";
import { saveReceipt, deleteReceipt } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { appUrl } from "@/services/email";
import { notifyExpenseApproval } from "@/services/notifications";
import { User } from "@/models/User";
import type { ActionState } from "@/types";

function ownableQuery(id: string, organizationId: string, session: Awaited<ReturnType<typeof requireTenant>>["session"]) {
  const query: Record<string, unknown> = { _id: id, organizationId };
  if (session.user.role === "staff") query.createdBy = session.user.userId;
  return query;
}

function revalidateExpenseAccounting(projectIds: Array<unknown>) {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/projects");
  for (const projectId of projectIds) {
    if (projectId) revalidatePath(`/projects/${projectId.toString()}`);
  }
}

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
      approvalStatus: session.user.role === "staff" ? "pending" : "approved",
      approvedBy: session.user.role === "staff" ? null : session.user.userId,
      approvedAt: session.user.role === "staff" ? null : new Date(),
      receiptImageId,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Created", entityType: "Expense", entityId: expense._id.toString(), metadata: { amount: data.amount } });
    revalidateExpenseAccounting([data.projectId]);
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
    const updated = (await Expense.findOneAndUpdate(ownableQuery(id, organizationId, session), update, { new: false, runValidators: true }).lean()) as any;
    if (!updated) throw new Error("Expense not found or not allowed");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Updated", entityType: "Expense", entityId: id, metadata: { amount: data.amount } });
    revalidateExpenseAccounting([updated.projectId, data.projectId]);
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
  const expense = (await Expense.findOneAndDelete(ownableQuery(id, organizationId, session)).lean()) as any;
  if (!expense) throw new Error("Expense not found or not allowed");
  if (expense?.receiptImageId) await deleteReceipt(expense.receiptImageId.toString()).catch(() => undefined);
  await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Deleted", entityType: "Expense", entityId: id });
  revalidateExpenseAccounting([expense.projectId]);
}

export async function bulkLinkExpensesToProject(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const ids = formData.getAll("expenseIds").map(String).filter(Boolean);
    const projectId = String(formData.get("projectId") ?? "");
    if (!ids.length) throw new Error("Select at least one expense");
    if (projectId) {
      const project = await Project.exists({ _id: projectId, organizationId });
      if (!project) throw new Error("Project not found");
    }
    const previousExpenses = await Expense.find({ _id: { $in: ids }, organizationId }).select("projectId").lean();
    const result = await Expense.updateMany({ _id: { $in: ids }, organizationId }, { $set: { projectId: projectId || null } });
    await writeAuditLog({
      organizationId,
      userId: session.user.userId,
      action: projectId ? "Expenses Linked To Project" : "Expenses Unlinked From Project",
      entityType: "Expense",
      entityId: ids[0],
      metadata: { expenseIds: ids, projectId: projectId || null, count: result.modifiedCount }
    });
    revalidateExpenseAccounting([...previousExpenses.map((expense: any) => expense.projectId), projectId]);
    return { ok: true, message: `${result.modifiedCount} expenses moved` };
  } catch (error) {
    return actionError(error);
  }
}

export async function bulkUpdateExpenseApproval(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const ids = formData.getAll("expenseIds").map(String).filter(Boolean);
    if (!ids.length) throw new Error("Select at least one expense");
    const data = expenseApprovalSchema.parse({ approvalStatus: formData.get("approvalStatus") });
    const expenses = await Expense.find({ _id: { $in: ids }, organizationId }).select("projectId createdBy description amount").lean();
    if (!expenses.length) throw new Error("No matching expenses found");
    const approvalFields = {
      approvalStatus: data.approvalStatus,
      approvedBy: data.approvalStatus === "approved" ? session.user.userId : null,
      approvedAt: data.approvalStatus === "approved" ? new Date() : null
    };
    const result = await Expense.updateMany({ _id: { $in: ids }, organizationId }, { $set: approvalFields }, { runValidators: true });
    await writeAuditLog({
      organizationId,
      userId: session.user.userId,
      action: "Expense Approval Bulk Updated",
      entityType: "Expense",
      entityId: ids[0],
      metadata: { expenseIds: ids, approvalStatus: data.approvalStatus, count: result.modifiedCount }
    });
    await sendExpenseApprovalEmails(organizationId, expenses, data.approvalStatus).catch(() => undefined);
    revalidateExpenseAccounting(expenses.map((expense: any) => expense.projectId));
    return { ok: true, message: `${result.modifiedCount} expenses updated` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateExpenseApproval(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireTenant();
    await requireRole(["owner", "admin"]);
    await connectToDatabase();
    const id = String(formData.get("id"));
    const data = expenseApprovalSchema.parse({ approvalStatus: formData.get("approvalStatus") });
    const expense = (await Expense.findOneAndUpdate(
      { _id: id, organizationId },
      { approvalStatus: data.approvalStatus, approvedBy: data.approvalStatus === "approved" ? session.user.userId : null, approvedAt: data.approvalStatus === "approved" ? new Date() : null },
      { new: true, runValidators: true }
    ).lean()) as any;
    if (!expense) throw new Error("Expense not found");
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Expense Approval Updated", entityType: "Expense", entityId: id, metadata: data });
    await sendExpenseApprovalEmails(organizationId, [expense], data.approvalStatus).catch(() => undefined);
    revalidateExpenseAccounting([expense.projectId]);
    return { ok: true, message: "Approval saved" };
  } catch (error) {
    return actionError(error);
  }
}

async function sendExpenseApprovalEmails(organizationId: string, expenses: any[], approvalStatus: string) {
  const userIds = [...new Set(expenses.map((expense) => expense.createdBy?.toString?.()).filter(Boolean))];
  if (!userIds.length) return;
  const users = await User.find({ _id: { $in: userIds }, organizationId }).select("name email").lean();
  const userById = new Map(users.map((user: any) => [user._id.toString(), user]));
  await Promise.all(expenses.map((expense) => {
    const user = userById.get(expense.createdBy?.toString?.());
    if (!user?.email) return Promise.resolve();
    return notifyExpenseApproval(user, {
      description: expense.description,
      amount: expense.amount,
      approvalStatus,
      expenseUrl: appUrl(`/expenses/${expense._id}`)
    });
  }));
}
