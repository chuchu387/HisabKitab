"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, Trash2, Wallet } from "lucide-react";
import { deletePayslip, setPayslipStatus } from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { toast } from "sonner";

export function PayslipStatusActions({ id, status, isManager }: { id: string; status: string; isManager: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; message?: string }>, key: string) {
    setPending(key);
    try {
      const result = await action();
      toast[result.ok ? "success" : "error"](result.message ?? (result.ok ? "Done" : "Failed"));
      if (result.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (!isManager) return <p className="text-sm text-muted-foreground">Contact an admin for changes.</p>;

  return (
    <div className="space-y-3">
      {status === "draft" && (
        <Button type="button" variant="secondary" className="w-full" disabled={pending !== null} onClick={() => run(() => setPayslipStatus(id, "approved"), "approve")}>
          {pending === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve
        </Button>
      )}
      {status === "approved" && (
        <Button type="button" className="w-full" disabled={pending !== null} onClick={() => run(() => setPayslipStatus(id, "paid"), "paid")}>
          {pending === "paid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}Mark as Paid
        </Button>
      )}
      {status === "paid" && <p className="text-sm text-muted-foreground">This payslip has been paid and is locked.</p>}
      {status !== "paid" && (
        <ConfirmButton
          label="Delete payslip"
          title="Delete this payslip?"
          description="This will remove the payslip permanently."
          icon="trash"
          variant="destructive"
          className="w-full"
          onClick={() => run(() => deletePayslip(id), "delete")}
        />
      )}
    </div>
  );
}
