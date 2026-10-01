"use client";

import { useActionState } from "react";
import { createSalesOrder } from "@/actions/sales-orders";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { vatEffectiveDateLabel } from "@/utils/vat";

const initialState = { ok: false, message: "" };

export function SalesOrderForm({ clients, projects, organization }: { clients: any[]; projects: any[]; organization?: any }) {
  const [state, formAction, pending] = useActionState(createSalesOrder, initialState);
  const today = new Date().toISOString().slice(0, 10);
  const vatRegistered = Boolean(organization?.vatRegistered);
  const vatEffectiveDate = vatEffectiveDateLabel(organization?.vatEffectiveDate);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-3">
      {!vatRegistered && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 md:col-span-3">
          VAT is disabled for this organization. Enable VAT registration in Settings to calculate VAT on sales orders.
        </div>
      )}
      {vatRegistered && vatEffectiveDate && today < vatEffectiveDate && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 md:col-span-3">
          VAT will apply to sales orders dated {vatEffectiveDate} or later.
        </div>
      )}
      <Field name="orderNumber" label="SO No." placeholder="SO-0001" />
      <Field name="orderDate" label="Order Date" type="date" defaultValue={today} />
      <Field name="expectedInvoiceDate" label="Expected Invoice Date" type="date" required={false} />
      <div className="space-y-2">
        <Label>Client</Label>
        <Select name="clientId" required defaultValue="">
          <option value="" disabled>{clients.length ? "Select client" : "No clients found"}</option>
          {clients.map((client) => <option key={client._id} value={client._id}>{client.name}{client.code ? ` (${client.code})` : ""}</option>)}
        </Select>
      </div>
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
          <option value="accepted">Accepted</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <div className="md:col-span-3"><Field name="description" label="Line Description" placeholder="Software development service" /></div>
      <Field name="quantity" label="Qty" type="number" min="0.01" step="0.01" defaultValue="1" />
      <Field name="rate" label="Rate" type="number" min="0" step="0.01" />
      <div className="space-y-2">
        <Label>VAT</Label>
        <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm shadow-sm">
          <input type="checkbox" name="vatApplicable" defaultChecked={vatRegistered} disabled={!vatRegistered} className="h-4 w-4 rounded border" />
          <span>{vatRegistered ? "Apply VAT" : "VAT not registered"}</span>
        </label>
      </div>
      <Field name="vatRate" label="VAT %" type="number" min="0" step="0.01" defaultValue={organization?.defaultVatRate ?? 13} />
      <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea name="notes" /></div>
      <div className="grid gap-3 md:col-span-3">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Creating..." : "Create Sales Order"}</Button>
      </div>
    </form>
  );
}

function Field({ label, required = true, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required={required} /></div>;
}
