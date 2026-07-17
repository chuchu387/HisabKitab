"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, FolderInput } from "lucide-react";
import { bulkLinkExpensesToProject, bulkUpdateExpenseApproval, deleteExpense, updateExpenseApproval } from "@/actions/expenses";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Select } from "@/components/ui/select";
import { formatDate, money } from "@/lib/utils";

const approvalInitialState = { ok: false, message: "" };
const bulkMoveInitialState = { ok: false, message: "" };

export function BulkLinkExpensesForm({
  expenses,
  projects,
  canApprove = false,
  pagination
}: {
  expenses: any[];
  projects: any[];
  canApprove?: boolean;
  pagination?: { total: number; page: number; pageSize: number; searchParams?: Record<string, string | string[] | undefined> };
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveState, moveAction, movePending] = useActionState(bulkLinkExpensesToProject, bulkMoveInitialState);
  if (!expenses.length) return null;
  const pageSize = pagination?.pageSize ?? expenses.length;
  const total = pagination?.total ?? expenses.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(pagination?.page ?? 1, totalPages);
  const start = (safePage - 1) * pageSize;
  const toggleExpense = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((selectedId) => selectedId !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{selectedIds.length} selected</p>
          <div className="space-y-1">
            <form id="bulk-expense-link-form" action={moveAction} className="grid gap-2 sm:flex sm:items-center">
              {selectedIds.map((id) => <input key={id} type="hidden" name="expenseIds" value={id} />)}
              <Select name="projectId" className="sm:w-72" defaultValue="">
                <option value="">General Expense</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name} ({project.code})
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" disabled={movePending || selectedIds.length === 0} className="w-full sm:w-auto">
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

      <div className="max-w-full overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[820px] text-sm">
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
        <div className="flex flex-col gap-3 border-t bg-muted/25 px-3 py-3 text-sm text-muted-foreground sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            Showing <span className="font-medium text-foreground">{start + 1}-{start + expenses.length}</span> of <span className="font-medium text-foreground">{total}</span> expenses
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="flex w-full overflow-x-auto rounded-md border bg-card p-1 sm:w-auto">
              {[10, 25, 50, 100].map((size) => (
                <Link
                  key={size}
                  href={expensePageHref(pagination?.searchParams, 1, size)}
                  className={size === pageSize ? "rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground" : "rounded px-2 py-1 text-xs font-medium hover:bg-secondary"}
                >
                  {size}
                </Link>
              ))}
            </div>
            <div className="flex w-full items-center gap-1 overflow-x-auto sm:w-auto">
            <ExpensePageLink className="hidden sm:inline-flex" label="First" href={expensePageHref(pagination?.searchParams, 1, pageSize)} disabled={safePage <= 1} />
            <ExpensePageLink label="Prev" href={expensePageHref(pagination?.searchParams, Math.max(1, safePage - 1), pageSize)} disabled={safePage <= 1} />
            <span className="px-2 text-xs font-medium">Page {safePage} of {totalPages}</span>
            <ExpensePageLink label="Next" href={expensePageHref(pagination?.searchParams, Math.min(totalPages, safePage + 1), pageSize)} disabled={safePage >= totalPages} />
            <ExpensePageLink className="hidden sm:inline-flex" label="Last" href={expensePageHref(pagination?.searchParams, totalPages, pageSize)} disabled={safePage >= totalPages} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpensePageLink({ label, href, disabled, className = "" }: { label: string; href: string; disabled?: boolean; className?: string }) {
  if (disabled) return <span className={`rounded-md border bg-muted px-2.5 py-1.5 text-xs font-medium opacity-50 ${className}`}>{label}</span>;
  return <Link href={href} className={`rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-secondary ${className}`}>{label}</Link>;
}

function expensePageHref(searchParams: Record<string, string | string[] | undefined> | undefined, page: number, pageSize: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `/expenses?${params.toString()}`;
}

function BulkApprovalForm({ selectedIds }: { selectedIds: string[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function submitBulkApproval(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await bulkUpdateExpenseApproval({ ok: false, message: "" }, formData);
      setMessage(result.message);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-1">
      <form id="bulk-expense-approval-form" action={submitBulkApproval} className="grid gap-2 sm:flex sm:items-center">
        {selectedIds.map((id) => <input key={id} type="hidden" name="expenseIds" value={id} />)}
        <Select name="approvalStatus" defaultValue="approved" className="sm:w-72">
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Button type="submit" variant="outline" disabled={pending || selectedIds.length === 0} className="w-full sm:w-auto">
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Saving..." : "Update Selected Approval"}
        </Button>
      </form>
      {message && <p className={message.includes("updated") ? "text-sm text-primary" : "text-sm text-destructive"}>{message}</p>}
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
