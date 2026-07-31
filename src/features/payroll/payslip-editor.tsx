"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { savePayslip } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function PayslipEditor({ payslip }: { payslip: any }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [allowances, setAllowances] = useState(payslip.allowances?.length ? payslip.allowances : [{ label: "", amount: 0 }]);
  const [deductions, setDeductions] = useState(payslip.deductions?.length ? payslip.deductions : [{ label: "", amount: 0 }]);

  function updateRows(setter: any, index: number, key: string, value: string) {
    setter((rows: any[]) => rows.map((row, i) => (i === index ? { ...row, [key]: key === "amount" ? Number(value) || 0 : value } : row)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    allowances.forEach((row: any, index: number) => {
      formData.append("allowanceLabels", String(row.label || ""));
      formData.append("allowanceAmounts", String(Number(row.amount) || 0));
    });
    deductions.forEach((row: any, index: number) => {
      formData.append("deductionLabels", String(row.label || ""));
      formData.append("deductionAmounts", String(Number(row.amount) || 0));
    });
    try {
      const result = await savePayslip(formData);
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={payslip._id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="bonus">Bonus</Label><Input id="bonus" name="bonus" type="number" min="0" step="0.01" defaultValue={payslip.bonus || 0} /></div>
        <div><Label htmlFor="overtimeHours">Overtime Hours</Label><Input id="overtimeHours" name="overtimeHours" type="number" min="0" step="0.5" defaultValue={payslip.overtimeHours || 0} /></div>
        <div><Label htmlFor="overtimeRate">Overtime Rate (per hour)</Label><Input id="overtimeRate" name="overtimeRate" type="number" min="0" step="0.01" defaultValue={payslip.overtimeRate || 0} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Allowances</Label>
          {allowances.map((row: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Input placeholder="Label (e.g. Travel)" value={row.label} onChange={(e) => updateRows(setAllowances, index, "label", e.target.value)} />
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={row.amount} onChange={(e) => updateRows(setAllowances, index, "amount", e.target.value)} className="w-32" />
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAllowances((rows: any[]) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setAllowances((rows: any[]) => [...rows, { label: "", amount: 0 }])}><Plus className="h-4 w-4" />Add allowance</Button>
        </div>
        <div className="space-y-2">
          <Label>Deductions</Label>
          {deductions.map((row: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <Input placeholder="Label (e.g. Loan)" value={row.label} onChange={(e) => updateRows(setDeductions, index, "label", e.target.value)} />
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={row.amount} onChange={(e) => updateRows(setDeductions, index, "amount", e.target.value)} className="w-32" />
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setDeductions((rows: any[]) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setDeductions((rows: any[]) => [...rows, { label: "", amount: 0 }])}><Plus className="h-4 w-4" />Add deduction</Button>
        </div>
      </div>
      <div><Label htmlFor="advanceDeduction">Advance Deduction</Label><Input id="advanceDeduction" name="advanceDeduction" type="number" min="0" step="0.01" defaultValue={payslip.advanceDeduction || 0} /></div>
      <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={2} defaultValue={payslip.notes || ""} /></div>
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button>
    </form>
  );
}
