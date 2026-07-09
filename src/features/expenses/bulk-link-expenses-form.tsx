"use client";

import Link from "next/link";
import { FolderInput } from "lucide-react";
import { bulkLinkExpensesToProject, deleteExpense, updateExpenseApproval } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Select } from "@/components/ui/select";
import { formatDate, money } from "@/lib/utils";

export function BulkLinkExpensesForm({ expenses, projects, canApprove = false }: { expenses: any[]; projects: any[]; canApprove?: boolean }) {
  if (!expenses.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <form id="bulk-expense-link-form" action={bulkLinkExpensesToProject} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select name="projectId" className="sm:w-72" defaultValue="">
            <option value="">General Expense</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name} ({project.code})
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            <FolderInput className="h-4 w-4" />
            Move Selected
          </Button>
        </form>
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
                    <input form="bulk-expense-link-form" type="checkbox" name="expenseIds" value={expense._id} className="h-4 w-4 rounded border" />
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

function ApprovalForm({ id, status }: { id: string; status: string }) {
  return (
    <form action={updateExpenseApproval} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <Select name="approvalStatus" defaultValue={status} className="h-8 min-w-28 text-xs">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </Select>
      <Button size="sm" variant="outline">Save</Button>
    </form>
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
