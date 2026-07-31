"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { saveSalarySetting } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { money } from "@/lib/utils";
import { toast } from "sonner";

export function SalarySettingsForm({ user }: { user: any }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [allowances, setAllowances] = useState(user.setting?.allowances?.length ? user.setting.allowances : [{ label: "", amount: 0 }]);

  function updateRows(index: number, key: string, value: string) {
    setAllowances((rows: any[]) => rows.map((row, i) => (i === index ? { ...row, [key]: key === "amount" ? Number(value) || 0 : value } : row)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("userId", user._id);
    allowances.forEach((row: any) => {
      formData.append("allowanceLabels", String(row.label || ""));
      formData.append("allowanceAmounts", String(Number(row.amount) || 0));
    });
    try {
      const result = await saveSalarySetting(formData);
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40">
        <div className="flex-1">
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
        </div>
        <p className="text-sm font-semibold">{user.setting ? money(user.setting.baseSalary) : "Not set"}</p>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor={`base-${user._id}`}>Base Salary (monthly)</Label><Input id={`base-${user._id}`} name="baseSalary" type="number" min="0" step="0.01" defaultValue={user.setting?.baseSalary ?? ""} placeholder="0" required /></div>
            <div><Label htmlFor={`ot-${user._id}`}>Overtime Rate (per hour)</Label><Input id={`ot-${user._id}`} name="overtimeRate" type="number" min="0" step="0.01" defaultValue={user.setting?.overtimeRate ?? 0} /></div>
          </div>
          <div className="space-y-2">
            <Label>Recurring Allowances</Label>
            {allowances.map((row: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <Input placeholder="Label (e.g. Travel)" value={row.label} onChange={(e) => updateRows(index, "label", e.target.value)} />
                <Input type="number" min="0" step="0.01" placeholder="Amount" value={row.amount} onChange={(e) => updateRows(index, "amount", e.target.value)} className="w-32" />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAllowances((rows: any[]) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setAllowances((rows: any[]) => [...rows, { label: "", amount: 0 }])}><Plus className="h-4 w-4" />Add allowance</Button>
          </div>
          <div><Label htmlFor={`notes-${user._id}`}>Notes</Label><Textarea id={`notes-${user._id}`} name="notes" rows={2} defaultValue={user.setting?.notes ?? ""} /></div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button>
            <span className="text-xs text-muted-foreground">Snapshot is taken when generating payslips.</span>
          </div>
        </form>
      )}
    </div>
  );
}
