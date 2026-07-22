"use client";

import { useActionState } from "react";
import { createClient, updateClient } from "@/actions/clients";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function ClientForm({ client }: { client?: any }) {
  const action = client ? updateClient.bind(null, client._id.toString()) : createClient;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 shadow-sm shadow-foreground/5 sm:p-5 md:grid-cols-2">
      <Field name="name" label="Client Name" defaultValue={client?.name} error={state.fieldErrors?.name?.[0]} />
      <Field name="code" label="Code" defaultValue={client?.code} error={state.fieldErrors?.code?.[0]} />
      <Field name="contactPerson" label="Contact Person" defaultValue={client?.contactPerson} error={state.fieldErrors?.contactPerson?.[0]} />
      <Field name="email" label="Email" type="email" defaultValue={client?.email} error={state.fieldErrors?.email?.[0]} />
      <Field name="phone" label="Phone" defaultValue={client?.phone} error={state.fieldErrors?.phone?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="active">Status</Label>
        <Select id="active" name="active" defaultValue={String(client?.active ?? true)}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" defaultValue={client?.address} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={client?.notes} />
      </div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Client"}</Button>
      </div>
    </form>
  );
}

function Field({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={String(props.name)}>{label}</Label>
      <Input id={String(props.name)} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
