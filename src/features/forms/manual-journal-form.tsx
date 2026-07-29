"use client";

import { useActionState } from "react";
import { createManualJournal } from "@/actions/journal-entries";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { ok: false, message: "" };

export function ManualJournalForm() {
  const [state, formAction, pending] = useActionState(createManualJournal, initialState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-3">
      <Field name="entryDate" label="Date" type="date" defaultValue={today} />
      <Field name="amount" label="Amount" type="number" min="0.01" step="0.01" />
      <Field name="memo" label="Memo" />
      <Field name="debitAccountCode" label="Debit Code" />
      <Field name="debitAccountName" label="Debit Account" />
      <Field name="creditAccountCode" label="Credit Code" />
      <Field name="creditAccountName" label="Credit Account" />
      <div className="grid gap-3 md:col-span-3"><ActionMessage state={state} /><Button disabled={pending}>{pending ? "Posting..." : "Post Journal"}</Button></div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required /></div>;
}
