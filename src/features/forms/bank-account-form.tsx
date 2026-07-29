"use client";

import { useActionState } from "react";
import { createBankAccount } from "@/actions/bank-accounts";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const initialState = { ok: false, message: "" };

export function BankAccountForm() {
  const [state, formAction, pending] = useActionState(createBankAccount, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-3">
      <Field name="name" label="Name" />
      <Field name="code" label="Code" />
      <Field name="accountNumber" label="Account Number" required={false} />
      <div className="space-y-2"><Label>Type</Label><Select name="type" defaultValue="bank"><option value="bank">Bank</option><option value="cash">Cash</option><option value="wallet">Wallet</option></Select></div>
      <Field name="openingBalance" label="Opening Balance" type="number" step="0.01" defaultValue="0" />
      <div className="grid gap-2"><span className="text-sm font-medium text-transparent">Action</span><Button disabled={pending}>{pending ? "Saving..." : "Create Account"}</Button></div>
      <div className="md:col-span-3"><ActionMessage state={state} /></div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required={props.required !== false} /></div>;
}
