"use client";

import { useActionState } from "react";
import { createPurchaseOrder } from "@/actions/purchase-orders";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function PurchaseOrderForm({ projects }: { projects: any[] }) {
  const [state, formAction, pending] = useActionState(createPurchaseOrder, initialState);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-3">
      <Field name="orderNumber" label="PO No." placeholder="PO-0001" />
      <Field name="orderDate" label="Order Date" type="date" defaultValue={today} />
      <Field name="expectedBillDate" label="Expected Bill Date" type="date" required={false} />
      <Field name="vendorName" label="Vendor" placeholder="Supplier name" />
      <Field name="vendorPan" label="Vendor PAN/VAT" required={false} />
      <div className="space-y-2">
        <Label>Project</Label>
        <Select name="projectId" defaultValue="">
          <option value="">No project</option>
          {projects.map((project) => <option key={project._id} value={project._id}>{project.name}{project.code ? ` (${project.code})` : ""}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select name="status" defaultValue="draft">
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <div className="md:col-span-2"><Field name="description" label="Line Description" placeholder="Laptop, service subscription, office supplies" /></div>
      <Field name="quantity" label="Qty" type="number" min="0.01" step="0.01" defaultValue="1" />
      <Field name="rate" label="Rate" type="number" min="0" step="0.01" />
      <div className="space-y-2">
        <Label>VAT</Label>
        <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm shadow-sm">
          <input type="checkbox" name="taxable" className="h-4 w-4 rounded border" />
          <span>Taxable purchase</span>
        </label>
      </div>
      <Field name="vatRate" label="VAT %" type="number" min="0" step="0.01" defaultValue="13" />
      <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea name="notes" /></div>
      <div className="grid gap-3 md:col-span-3">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Creating..." : "Create Purchase Order"}</Button>
      </div>
    </form>
  );
}

function Field({ label, required = true, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required={required} /></div>;
}
