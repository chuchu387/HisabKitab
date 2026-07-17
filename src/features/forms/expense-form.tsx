"use client";

import { useActionState } from "react";
import { createExpense, updateExpense } from "@/actions/expenses";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

const initialState = { ok: false, message: "" };

export function ExpenseForm({ expense, categories, projects }: { expense?: any; categories: any[]; projects: any[] }) {
  const action = expense ? updateExpense.bind(null, expense._id.toString()) : createExpense;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 sm:p-5 shadow-sm shadow-foreground/5 md:grid-cols-2" encType="multipart/form-data">
      <Field name="expenseDate" label="Expense Date" type="date" defaultValue={formatDate(expense?.expenseDate ?? new Date())} />
      <Field name="amount" label="Amount" type="number" min="0.01" step="0.01" defaultValue={expense?.amount} />
      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <Select id="categoryId" name="categoryId" defaultValue={expense?.categoryId?.toString()}>
          {categories.map((category) => <option key={category._id.toString()} value={category._id.toString()}>{category.name}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectId">Project</Label>
        <Select id="projectId" name="projectId" defaultValue={expense?.projectId?.toString() ?? ""}>
          <option value="">General Expense</option>
          {projects.map((project) => <option key={project._id.toString()} value={project._id.toString()}>{project.name}</option>)}
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={expense?.description} /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="receipt">Receipt Image</Label><Input id="receipt" name="receipt" type="file" accept="image/*" /></div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Expense"}</Button>
      </div>
      <p className="text-xs text-muted-foreground md:col-span-2">Staff expenses are saved as pending until Owner/Admin approval. Approved expenses affect accounting totals.</p>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
