"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestLeave, approveLeave } from "@/actions/leaves";

export function LeaveManager({ leaves, members, pending, month, isAdmin, userId }: { leaves: any[]; members: { _id: string; name: string }[]; pending: number; month: string; isAdmin: boolean; userId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const [prev, next] = (() => {
    const [y, m] = month.split("-").map(Number);
    return [`${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`, `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`];
  })();

  async function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const res = await requestLeave(fd);
    if (!res.ok) { toast.error(res.message); setSubmitting(false); return; }
    toast.success(res.message);
    setShowForm(false);
    setSubmitting(false);
    router.refresh();
  }

  async function handleApprove(id: string, status: "approved" | "rejected") {
    const res = await approveLeave(id, status);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(res.message);
    router.refresh();
  }

  const myLeaves = leaves.filter((l) => l.userId?._id === userId);
  const allLeaves = isAdmin ? leaves : myLeaves;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={`/attendance/leaves?month=${prev}`} className="text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="text-lg font-semibold">{month}</span>
          <Link href={`/attendance/leaves?month=${next}`} className="text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && isAdmin && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{pending} pending</span>}
          {!showForm && <Button onClick={() => setShowForm(true)} variant="outline" size="sm"><Plus className="h-4 w-4" /> Request Leave</Button>}
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Request Leave</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleRequest} className="flex flex-wrap gap-3">
              <input type="date" name="date" required defaultValue={month + "-01"} className="rounded-md border bg-background px-3 py-2 text-sm" />
              <input type="text" name="reason" placeholder="Reason (optional)" className="min-w-[200px] flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Submit
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}><X className="h-4 w-4" /> Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{isAdmin ? "All Leaves" : "My Leaves"}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allLeaves.map((l: any) => {
                const user = l.userId ?? {};
                return (
                  <div key={l._id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{user.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{l.date}{l.reason ? ` — ${l.reason}` : ""}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${l.status === "approved" ? "bg-primary/10 text-primary" : l.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                      {l.status}
                    </span>
                    {l.status === "pending" && isAdmin && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => handleApprove(l._id, "approved")} className="rounded p-1 text-primary hover:bg-primary/10"><Check className="h-4 w-4" /></button>
                        <button type="button" onClick={() => handleApprove(l._id, "rejected")} className="rounded p-1 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
              {!allLeaves.length && <p className="py-6 text-center text-sm text-muted-foreground">No leaves for this month</p>}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
