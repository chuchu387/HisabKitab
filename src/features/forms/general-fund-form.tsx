"use client";

import { useActionState } from "react";
import { createGeneralFund } from "@/actions/general-funds";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function GeneralFundForm() {
  const [state, formAction, pending] = useActionState(createGeneralFund, initialState);
  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-4 rounded-lg border bg-card/95 p-5 shadow-sm shadow-foreground/5 md:grid-cols-2">
      <Field name="fundDate" label="Fund Date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Field name="amount" label="Amount" type="number" min="0.01" step="0.01" />
      <div className="space-y-2 md:col-span-2">
        <Label>Receipt Image</Label>
        <Input name="receipt" type="file" accept="image/*" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Note</Label>
        <Textarea name="note" />
      </div>
      <div className="flex items-center justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Add Fund"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} /></div>;
}
