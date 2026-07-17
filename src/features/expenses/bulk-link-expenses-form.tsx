"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, FolderInput } from "lucide-react";
import { bulkLinkExpensesToProject, bulkUpdateExpenseApproval, deleteExpense, updateExpenseApproval } from "@/actions/expenses";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Select } from "@/components/ui/select";
import { formatDate, money } from "@/lib/utils";

const approvalInitialState = { ok: false, message: "" };
const bulkApprovalInitialState = { ok: false, message: "" };
const bulkMoveInitialState = { ok: false, message: "" };

export function BulkLinkExpensesForm({ expenses, projects, canApprove = false }: { expenses: any[]; projects: any[]; canApprove?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveState, moveAction, movePending] = useActionState(bulkLinkExpensesToProject, bulkMoveInitialState);
  if (!expenses.length) return null;
  const toggleExpense = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((selectedId) => selectedId !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="space-y-1">
            <form id="bulk-expense-link-form" action={moveAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedIds.map((id) => <input key={id} type="hidden" name="expenseIds" value={id} />)}
              <Select name="projectId" className="sm:w-72" defaultValue="">
                <option value="">General Expense</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name} ({project.code})
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" disabled={movePending}>
                <FolderInput className="h-4 w-4" />
                {movePending ? "Moving..." : "Move Selected"}
              </Button>
            </form>
            <ActionMessage state={moveState} />
          </div>
          {canApprove && <BulkApprovalForm selectedIds={selectedIds} />}
        </div>
        <p className="text-sm text-muted-foreground">Select expenses below, then move them to a project or back to general.</p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3 font-medium">Pick</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Added By</th>
                <th className="px-4 py-3 font-medium">Approval</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((expense) => (
                <tr key={expense._id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(expense._id)}
                      onChange={(event) => toggleExpense(expense._id, event.target.checked)}
                      className="h-4 w-4 rounded border"
                    />
                  </td>
                  <td className="px-4 py-3">{formatDate(expense.expenseDate)}</td>
                  <td className="px-4 py-3">{expense.categoryId?.name ?? "-"}</td>
                  <td className="px-4 py-3">{expense.projectId?.name ?? "General"}</td>
                  <td className="px-4 py-3">
                    <Link className="font-medium hover:text-primary" href={`/expenses/${expense._id}`}>
                      {expense.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{expense.createdBy?.name ?? "Unknown"}</td>
                  <td className="px-4 py-3">{canApprove ? <ApprovalForm id={expense._id} status={expense.approvalStatus ?? "pending"} /> : (expense.approvalStatus ?? "pending")}</td>
                  <td className="px-4 py-3">{money(expense.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/expenses/${expense._id}/edit`}>Edit</Link>
                      </Button>
                      <DeleteExpenseForm id={expense._id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BulkApprovalForm({ selectedIds }: { selectedIds: string[] }) {
  const [state, formAction, pending] = useActionState(bulkUpdateExpenseApproval, bulkApprovalInitialState);
  return (
    <div className="space-y-1">
      <form id="bulk-expense-approval-form" action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {selectedIds.map((id) => <input key={id} type="hidden" name="expenseIds" value={id} />)}
        <Select name="approvalStatus" defaultValue="approved" className="sm:w-72">
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button type="submit" variant="outline" disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Saving..." : "Update Selected Approval"}
        </Button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

function ApprovalForm({ id, status }: { id: string; status: string }) {
  const [state, formAction, pending] = useActionState(updateExpenseApproval, approvalInitialState);
  return (
    <div className="space-y-1">
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="id" value={id} />
        <Select name="approvalStatus" defaultValue={status} className="h-8 min-w-28 text-xs">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

function DeleteExpenseForm({ id }: { id: string }) {
  return (
    <form action={deleteExpense}>
      <input type="hidden" name="id" value={id} />
      <ConfirmButton />
    </form>
  );
}
