"use client";

import { useActionState } from "react";
import { createLead, updateLead } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadSources, leadSourceLabels, leadStatuses, leadStatusLabels } from "@/constants";
import { formatDate } from "@/lib/utils";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function LeadForm({ lead, users = [], campaigns, projects = [], products = [] }: { lead?: any; users?: any[]; campaigns?: { _id: string; name: string }[]; projects?: { _id: string; name: string }[]; products?: { _id: string; name: string; category?: string }[] }) {
  const action = lead ? updateLead.bind(null, lead._id.toString()) : createLead;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 shadow-sm shadow-foreground/5 sm:p-5 md:grid-cols-2">
      <Field name="name" label="Lead Name" defaultValue={lead?.name} error={state.fieldErrors?.name?.[0]} />
      <Field name="company" label="Company" defaultValue={lead?.company} error={state.fieldErrors?.company?.[0]} />
      <Field name="email" label="Email" type="email" defaultValue={lead?.email} error={state.fieldErrors?.email?.[0]} />
      <Field name="phone" label="Phone" defaultValue={lead?.phone} error={state.fieldErrors?.phone?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="source">Source</Label>
        <Select id="source" name="source" defaultValue={lead?.source ?? "referral"}>
          {leadSources.map((source) => <option key={source} value={source}>{leadSourceLabels[source]}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={lead?.status ?? "new"}>
          {leadStatuses.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}
        </Select>
      </div>
      <Field name="estimatedValue" label="Estimated Value (Rs.)" type="number" min="0" step="0.01" defaultValue={lead?.estimatedValue ?? 0} error={state.fieldErrors?.estimatedValue?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="assignedTo">Assigned To</Label>
        <Select id="assignedTo" name="assignedTo" defaultValue={lead?.assignedTo ?? ""}>
          <option value="">Unassigned</option>
          {users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
        </Select>
      </div>
      {campaigns && (
        <div className="space-y-2">
          <Label htmlFor="campaignId">Campaign</Label>
          <Select id="campaignId" name="campaignId" defaultValue={lead?.campaignId ?? ""}>
            <option value="">No campaign</option>
            {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </Select>
        </div>
      )}
      {projects && (
        <div className="space-y-2">
          <Label htmlFor="projectId">Project</Label>
          <Select id="projectId" name="projectId" defaultValue={lead?.projectId ?? ""}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="productId">Product / Service</Label>
        <Select id="productId" name="productId" defaultValue={lead?.productId ?? ""}>
          <option value="">No product</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}{p.category ? ` (${p.category})` : ""}</option>)}
        </Select>
      </div>
      <Field name="followUpDate" label="Follow-up Date" type="date" defaultValue={formatDate(lead?.followUpDate)} error={state.fieldErrors?.followUpDate?.[0]} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={lead?.notes} />
      </div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : lead ? "Update Lead" : "Create Lead"}</Button>
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
