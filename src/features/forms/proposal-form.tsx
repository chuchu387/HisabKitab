"use client";

import { useState, useEffect, useActionState } from "react";
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

export function ProposalForm({ proposal, leads = [], products }: { proposal?: any; leads?: any[]; products?: { _id: string; name: string; unitPrice: number; unit: string }[] }) {
  const action = proposal ? updateProposal.bind(null, proposal._id.toString()) : createProposal;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [amount, setAmount] = useState(proposal?.amount ?? 0);
  const [lineItems, setLineItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([]);

  useEffect(() => {
    const total = lineItems.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
    setAmount(total);
  }, [lineItems]);

  function addLine() {
    setLineItems([...lineItems, { productId: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateLine(index: number, field: string, value: string | number) {
    const updated = lineItems.map((item, i) => i === index ? { ...item, [field]: value } : item);
    setLineItems(updated);
  }

  function removeLine(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function handleProductSelect(index: number, productId: string) {
    const product = products?.find((p) => p._id === productId);
    const updated = lineItems.map((item, i) =>
      i === index ? { ...item, productId, unitPrice: product?.unitPrice ?? 0 } : item
    );
    setLineItems(updated);
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 shadow-sm shadow-foreground/5 sm:p-5 md:grid-cols-2">
      <input type="hidden" name="amount" value={amount} />
      <Field name="title" label="Proposal Title" defaultValue={proposal?.title} error={state.fieldErrors?.title?.[0]} />
      <Field name="amount" label="Amount (Rs.)" type="number" min="0" step="0.01" value={amount} onChange={() => {}} error={state.fieldErrors?.amount?.[0]} />
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

      {products && (
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Products</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>Add Line</Button>
          </div>
          {lineItems.map((item, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="min-w-[180px] flex-1 space-y-1">
                <Label className="text-xs">Product</Label>
                <Select value={item.productId} onChange={(e) => handleProductSelect(index, e.target.value)}>
                  <option value="">Select product</option>
                  {products?.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.unit})</option>)}
                </Select>
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min="1" value={item.quantity} onChange={(e) => updateLine(index, "quantity", parseInt(e.target.value) || 0)} />
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs">Unit Price</Label>
                <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Total</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">
                  Rs. {(item.quantity * item.unitPrice).toLocaleString()}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(index)} className="text-destructive">Remove</Button>
            </div>
          ))}
        </div>
      )}

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
