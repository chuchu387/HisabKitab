"use client";

import { useActionState } from "react";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOrganization, updateOrganization } from "@/actions/organizations";

const initialState = { ok: false, message: "" };

export function OrganizationForm({ organization }: { organization?: any }) {
  const action = organization ? updateOrganization.bind(null, organization._id.toString()) : createOrganization;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue={organization?.name} />
      <Field name="code" label="Code" defaultValue={organization?.code} />
      <Field name="email" label={organization ? "Email" : "Admin Login Email"} type="email" defaultValue={organization?.email} />
      <Field name="phone" label="Phone" defaultValue={organization?.phone} />
      <Field name="generalBudget" label="General Budget" type="number" min="0" step="0.01" defaultValue={organization?.generalBudget ?? 0} />
      {!organization && (
        <>
          <Field name="adminName" label="Admin Name" defaultValue="" />
          <Field name="adminPassword" label="Admin Password" type="password" />
        </>
      )}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" defaultValue={organization?.address} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={organization?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>
      <div className="flex items-end justify-between gap-3 md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Organization"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
