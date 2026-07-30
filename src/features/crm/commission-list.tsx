"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { payCommission } from "@/actions/commissions";
import { money } from "@/lib/utils";

export function CommissionList({ commissions, users }: { commissions: any[]; users: any[] }) {
  const router = useRouter();

  function findUser(id: string) {
    return users.find((u) => u._id === id);
  }

  const pendingTotal = commissions.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + (c.commissionAmount || 0), 0);
  const paidTotal = commissions.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + (c.commissionAmount || 0), 0);

  async function handlePay(id: string) {
    const res = await payCommission(id);
    if (!res.ok) { toast.error("Failed to mark as paid"); return; }
    toast.success("Commission marked as paid");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-destructive/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-destructive">Pending Amount</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-destructive">{money(pendingTotal)}</p></CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-primary">Paid Amount</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-primary">{money(paidTotal)}</p></CardContent>
        </Card>
      </div>

      <DataTable data={commissions.map((c: any) => ({ ...c, userName: findUser(c.userId)?.name || "Unknown" }))} columns={[
        { header: "User", cell: (r: any) => <span className="font-medium">{r.userName}</span> },
        { header: "Lead", cell: (r: any) => r.leadId?.name || "-" },
        { header: "Deal Value", cell: (r: any) => money(r.dealValue) },
        { header: "Commission", cell: (r: any) => <span className="font-semibold">{money(r.commissionAmount)}</span> },
        { header: "Status", cell: (r: any) => (
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${r.status === "paid" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
          </span>
        )},
        { header: "Actions", cell: (r: any) => r.status === "pending" ? <Button onClick={() => handlePay(r._id)} variant="outline" size="sm" className="text-xs">Mark Paid</Button> : null }
      ]} />
    </div>
  );
}
