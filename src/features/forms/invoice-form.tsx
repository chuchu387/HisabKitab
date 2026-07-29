"use client";

import { useActionState } from "react";
import { createInvoice } from "@/actions/invoices";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function InvoiceForm({ clients, projects, organization }: { clients: any[]; projects: any[]; organization?: any }) {
  const [state, formAction, pending] = useActionState(createInvoice, initialState);
  const today = new Date().toISOString().slice(0, 10);
  const defaultVatRate = organization?.defaultVatRate ?? 13;
  const vatRegistered = Boolean(organization?.vatRegistered);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-3">
      <Field name="invoiceNumber" label="Invoice No." />
      <Field name="invoiceDate" label="Invoice Date" type="date" defaultValue={today} />
      <Field name="dueDate" label="Due Date" type="date" defaultValue={today} />
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
          {projects.map((project) => <option key={project._id} value={project._id}>{project.name}{project.code ? ` (${project.code})` : ""}{project.projectType === "internal" ? " - Internal" : ""}</option>)}
        </Select>
      </div>
      <div className="space-y-2"><Label>Status</Label><Select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="sent">Sent</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="void">Void</option></Select></div>
      <div className="md:col-span-3"><Field name="description" label="Line Description" /></div>
      <Field name="quantity" label="Qty" type="number" min="0.01" step="0.01" defaultValue="1" />
      <Field name="rate" label="Rate" type="number" min="0" step="0.01" />
      <div className="space-y-2">
        <Label>VAT</Label>
        <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm shadow-sm">
          <input type="checkbox" name="vatApplicable" defaultChecked={vatRegistered} disabled={!vatRegistered} className="h-4 w-4 rounded border" />
          <span>{vatRegistered ? "Apply VAT" : "VAT not registered"}</span>
        </label>
      </div>
      <Field name="vatRate" label="VAT %" type="number" min="0" step="0.01" defaultValue={defaultVatRate} />
      <Field name="paidAmount" label="Paid Amount" type="number" min="0" step="0.01" defaultValue="0" />
      <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea name="notes" /></div>
      <div className="grid gap-3 md:col-span-3">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Create Invoice"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} required /></div>;
}
