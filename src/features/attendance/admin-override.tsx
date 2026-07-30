"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { adminMarkAttendance } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminOverride({ members }: { members: { _id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await adminMarkAttendance(formData);
    if (!result.ok) {
      toast.error(result.message);
      setPending(false);
      return;
    }
    toast.success(result.message);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Manual Override</CardTitle>
        <Button type="button" onClick={() => setOpen(!open)} variant="outline" size="sm">
          <Plus className="h-4 w-4" /> {open ? "Close" : "Add Record"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Member</label>
              <select name="userId" required className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Select member...</option>
                {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Check-in Time</label>
                <input type="time" name="checkInTime" required className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Check-out <span className="text-muted-foreground/60">(optional)</span></label>
                <input type="time" name="checkOutTime" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Note <span className="text-muted-foreground/60">(optional)</span></label>
                <input type="text" name="note" placeholder="Forgot to check in" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /> Cancel</Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {pending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
