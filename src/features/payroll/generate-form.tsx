"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { generatePayroll } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/utils";
import { toast } from "sonner";

export function GeneratePayrollForm({ month, users }: { month: string; users: any[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(users.filter((user) => user.setting).map((user) => user._id)));
  const [pending, setPending] = useState(false);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === users.length ? new Set() : new Set(users.map((user) => user._id))));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await generatePayroll(formData);
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) router.push("/payroll?month=" + month);
    } finally {
      setPending(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="month">Month</Label><Input id="month" name="month" type="month" defaultValue={month} required /></div>
        <div><Label htmlFor="overtimeHours">Default Overtime Hours</Label><Input id="overtimeHours" name="overtimeHours" type="number" min="0" step="0.5" defaultValue="0" /></div>
        <div><Label htmlFor="advanceDeduction">Advance Deduction (all staff)</Label><Input id="advanceDeduction" name="advanceDeduction" type="number" min="0" step="0.01" defaultValue="0" /></div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Staff ({selectedCount} selected)</Label>
          <button type="button" onClick={toggleAll} className="text-xs font-medium text-primary hover:underline">{selectedCount === users.length ? "Clear all" : "Select all"}</button>
        </div>
        <div className="grid max-h-80 gap-1.5 overflow-y-auto rounded-lg border p-2">
          {users.map((user) => (
            <label key={user._id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-secondary/40">
              <input type="checkbox" name="userIds" value={user._id} checked={selected.has(user._id)} onChange={() => toggle(user._id)} className="h-4 w-4" />
              <span className="flex-1 font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.role}</span>
              <span className="text-xs font-semibold">{user.setting ? money(user.setting.baseSalary) : "No salary set"}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Attendance is prorated automatically. Paid commissions from this month are included. Edit each payslip after generation.</p>
      </div>

      <Button type="submit" disabled={pending || selectedCount === 0}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Generate {selectedCount || ""} payslips
      </Button>
    </form>
  );
}
