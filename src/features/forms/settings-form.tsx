"use client";

import { useActionState } from "react";
import { updateOrganizationSettings } from "@/actions/organizations";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function SettingsForm({ organization }: { organization: any }) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettings, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 sm:p-5 shadow-sm shadow-foreground/5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue={organization.name} />
      <Field name="email" label="Email" type="email" defaultValue={organization.email} />
      <Field name="phone" label="Phone" defaultValue={organization.phone} />
      <Field name="generalBudget" label="Owner/Other Funds" type="number" min="0" step="0.01" defaultValue={organization.generalBudget ?? 0} />
      <div className="space-y-2 md:col-span-2"><Label htmlFor="address">Address</Label><Textarea id="address" name="address" defaultValue={organization.address} /></div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Settings"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
