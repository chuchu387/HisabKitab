"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createBankReconciliation } from "@/actions/reconciliations";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function ReconciliationForm({ bankAccounts }: { bankAccounts: any[] }) {
  const [state, formAction, pending] = useActionState(createBankReconciliation, initialState);
  useEffect(() => {
    if (state.message) toast[state.ok ? "success" : "error"](state.message);
  }, [state]);
  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-5">
      <select name="bankAccountId" className="native-control md:col-span-2" required>
        <option value="">Select bank/cash account</option>
        {bankAccounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
      </select>
      <input name="statementDate" type="date" className="native-control" required />
      <input name="statementBalance" type="number" step="0.01" className="native-control" placeholder="Statement balance" required />
      <Button disabled={pending}>{pending ? "Saving..." : "Save Reconciliation"}</Button>
      <label className="native-control flex h-auto flex-col gap-1 md:col-span-5">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Bank statement CSV</span>
        <input name="statementCsv" type="file" accept=".csv,text/csv" className="text-sm" />
        <span className="text-xs text-muted-foreground">Supported columns: Date, Description/Narration, Reference, Debit, Credit, Amount, Balance.</span>
      </label>
      <textarea name="note" className="native-control md:col-span-5" placeholder="Notes, uncleared cheques, bank charges, or audit comments" />
    </form>
  );
}
