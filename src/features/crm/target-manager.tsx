"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveSalesTarget } from "@/actions/commissions";

export function TargetManager({ users, targets, month }: { users: any[]; targets: any[]; month: string }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function findUser(id: string) {
    return users.find((u) => u._id === id);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const res = await saveSalesTarget(fd);
    if (!res.ok) { toast.error(res.message); setSubmitting(false); return; }
    toast.success(res.message);
    setShowForm(false);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!showForm && <Button onClick={() => setShowForm(true)} variant="outline" size="sm"><Plus className="h-4 w-4" /> Set Target</Button>}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Set Sales Target</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userId">User</Label>
                <Select id="userId" name="userId" required>
                  <option value="">Select user</option>
                  {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Input id="month" name="month" type="month" defaultValue={month} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAmount">Target Amount</Label>
                <Input id="targetAmount" name="targetAmount" type="number" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                <Input id="commissionRate" name="commissionRate" type="number" min="0" max="100" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionFixed">Commission Fixed (per deal)</Label>
                <Input id="commissionFixed" name="commissionFixed" type="number" min="0" step="0.01" />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Target Amount</th>
                <th className="px-4 py-3 font-medium">Commission Rate</th>
                <th className="px-4 py-3 font-medium">Commission Fixed</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t: any) => (
                <tr key={t._id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{findUser(t.userId)?.name || "Unknown"}</td>
                  <td className="px-4 py-3">Rs. {Number(t.targetAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{t.commissionRate || 0}%</td>
                  <td className="px-4 py-3">Rs. {Number(t.commissionFixed || 0).toLocaleString()}</td>
                </tr>
              ))}
              {!targets.length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No targets set for this month</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
