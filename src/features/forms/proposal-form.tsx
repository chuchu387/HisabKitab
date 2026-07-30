"use client";

import { useActionState } from "react";
import { createProposal, updateProposal } from "@/actions/proposals";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { proposalStatuses, proposalStatusLabels } from "@/constants";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function ProposalForm({ proposal, leads = [] }: { proposal?: any; leads?: any[] }) {
  const action = proposal ? updateProposal.bind(null, proposal._id.toString()) : createProposal;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 shadow-sm shadow-foreground/5 sm:p-5 md:grid-cols-2">
      <Field name="title" label="Proposal Title" defaultValue={proposal?.title} error={state.fieldErrors?.title?.[0]} />
      <Field name="amount" label="Amount (Rs.)" type="number" min="0" step="0.01" defaultValue={proposal?.amount ?? 0} error={state.fieldErrors?.amount?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="leadId">Related Lead</Label>
        <Select id="leadId" name="leadId" defaultValue={proposal?.leadId ?? ""}>
          <option value="">No lead</option>
          {leads.map((lead) => <option key={lead._id} value={lead._id}>{lead.name}{lead.company ? ` (${lead.company})` : ""}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={proposal?.status ?? "draft"}>
          {proposalStatuses.map((status) => <option key={status} value={status}>{proposalStatusLabels[status]}</option>)}
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={proposal?.description} />
      </div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : proposal ? "Update Proposal" : "Create Proposal"}</Button>
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
