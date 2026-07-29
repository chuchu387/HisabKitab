"use client";

import { useActionState } from "react";
import { createFiscalYear } from "@/actions/fiscal-years";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { ok: false, message: "" };

export function FiscalYearForm() {
  const [state, formAction, pending] = useActionState(createFiscalYear, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-4">
      <Field name="name" label="FY Name" placeholder="FY 2082/83" />
      <Field name="startDate" label="Start Date" type="date" />
      <Field name="endDate" label="End Date" type="date" />
      <div className="grid gap-2">
        <span className="text-sm font-medium text-transparent">Action</span>
        <Button disabled={pending}>{pending ? "Saving..." : "Create FY"}</Button>
      </div>
      <div className="md:col-span-4"><ActionMessage state={state} /></div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required /></div>;
}
