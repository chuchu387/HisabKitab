"use client";

import { useActionState } from "react";
import { createOpeningBalance } from "@/actions/opening-balances";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const initialState = { ok: false, message: "" };

export function OpeningBalanceForm({ fiscalYears = [] }: { fiscalYears?: any[] }) {
  const [state, formAction, pending] = useActionState(createOpeningBalance, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-3">
      <div className="space-y-2"><Label>Fiscal Year</Label><Select name="fiscalYearId"><option value="">No FY</option>{fiscalYears.map((year) => <option key={year._id} value={year._id}>{year.name}</option>)}</Select></div>
      <Field name="accountCode" label="Account Code" />
      <Field name="accountName" label="Account Name" />
      <Field name="debit" label="Debit" type="number" min="0" step="0.01" defaultValue="0" />
      <Field name="credit" label="Credit" type="number" min="0" step="0.01" defaultValue="0" />
      <Field name="note" label="Note" required={false} />
      <div className="grid gap-3 md:col-span-3"><ActionMessage state={state} /><Button disabled={pending}>{pending ? "Saving..." : "Add Opening Balance"}</Button></div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required={props.required !== false} /></div>;
}
