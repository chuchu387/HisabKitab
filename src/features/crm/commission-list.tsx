"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payCommission } from "@/actions/commissions";

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
        <Card>
          <CardHeader><CardTitle>Pending Amount</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">Rs. {pendingTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Paid Amount</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary">Rs. {paidTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Deal Value</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-28" />
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c._id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{findUser(c.userId)?.name || "Unknown"}</td>
                  <td className="px-4 py-3">{c.leadId?.name || "-"}</td>
                  <td className="px-4 py-3">Rs. {Number(c.dealValue || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">Rs. {Number(c.commissionAmount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${c.status === "paid" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "pending" && (
                      <Button onClick={() => handlePay(c._id)} variant="outline" size="sm">Mark Paid</Button>
                    )}
                  </td>
                </tr>
              ))}
              {!commissions.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No commissions yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
