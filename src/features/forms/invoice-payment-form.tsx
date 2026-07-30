"use client";

import { useActionState } from "react";
import { recordInvoicePayment } from "@/actions/invoices";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { dateInput } from "@/lib/utils";

const initialState = { ok: false, message: "" };

export function InvoicePaymentForm({ invoice, bankAccounts, dueAmount }: { invoice: any; bankAccounts: any[]; dueAmount: number }) {
  const [state, formAction, pending] = useActionState(recordInvoicePayment, initialState);
  const disabled = dueAmount <= 0 || !invoice.projectId;
  return (
    <form action={formAction} className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-4">
      <input type="hidden" name="invoiceId" value={invoice._id} />
      <div className="space-y-2">
        <Label>Payment Date</Label>
        <Input type="date" name="paymentDate" defaultValue={dateInput(new Date())} required disabled={disabled || pending} />
      </div>
      <div className="space-y-2">
        <Label>Amount</Label>
        <Input type="number" name="amount" min="0.01" step="0.01" defaultValue={dueAmount.toFixed(2)} required disabled={disabled || pending} />
      </div>
      <div className="space-y-2">
        <Label>Bank Account</Label>
        <Select name="bankAccountId" disabled={disabled || pending}>
          <option value="">Default cash/bank</option>
          {bankAccounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Note</Label>
        <Input name="note" defaultValue={`Payment for ${invoice.invoiceNumber}`} disabled={disabled || pending} />
      </div>
      <div className="grid gap-3 md:col-span-4">
        {!invoice.projectId && <p className="text-sm text-destructive">Link this invoice to a project before recording a project payment.</p>}
        <ActionMessage state={state} />
        <Button disabled={disabled || pending}>{pending ? "Recording..." : dueAmount > 0 ? "Record Payment" : "Invoice Paid"}</Button>
      </div>
    </form>
  );
}
