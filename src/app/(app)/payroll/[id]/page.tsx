import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Payroll } from "@/models/Payroll";
import { PayslipEditor } from "@/features/payroll/payslip-editor";
import { PayslipStatusActions } from "@/features/payroll/payslip-status-actions";

const statusBadge: Record<string, "default" | "success" | "warning"> = { draft: "warning", approved: "default", paid: "success" };

function EarningsRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{money(amount)}</span>
    </div>
  );
}

export default async function PayslipPage({ params }: any) {
  await requireFeature("payrollView");
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const { id } = await params;
  const payslip = await Payroll.findOne({ _id: id, organizationId }).populate("userId", "name role").lean() as any;
  if (!payslip) notFound();
  const isManager = ["owner", "admin"].includes(session.user.role);
  if (session.user.role === "staff" && String(payslip.userId._id) !== String(session.user.userId)) notFound();

  return (
    <PageShell title="Payslip" action={
      <div className="flex items-center gap-2">
        <Button asChild variant="outline"><Link href="/payroll"><ArrowLeft className="h-4 w-4" />Payroll</Link></Button>
      </div>
    }>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{payslip.userId?.name ?? "Unknown"}</CardTitle>
                  <p className="text-xs text-muted-foreground capitalize">{payslip.userId?.role} · {payslip.month} · {payslip.presentDays}/{payslip.workingDays} days attended</p>
                </div>
                <Badge variant={statusBadge[payslip.status] ?? "default"}>{payslip.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Earnings</p>
                  <EarningsRow label="Base salary (prorated)" amount={payslip.baseSalary} />
                  {payslip.allowances?.map((item: any, index: number) => <EarningsRow key={index} label={item.label || "Allowance"} amount={item.amount} />)}
                  <EarningsRow label="Commission" amount={payslip.commission} />
                  <EarningsRow label="Overtime" amount={(payslip.overtimeHours || 0) * (payslip.overtimeRate || 0)} />
                  <EarningsRow label="Bonus" amount={payslip.bonus} />
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>Gross</span><span>{money(payslip.grossPay)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
                  {payslip.deductions?.length ? payslip.deductions.map((item: any, index: number) => <EarningsRow key={index} label={item.label || "Deduction"} amount={item.amount} />) : <EarningsRow label="No deductions" amount={0} />}
                  <EarningsRow label="Advance deduction" amount={payslip.advanceDeduction} />
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>Total deductions</span><span>{money(payslip.totalDeductions)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5 text-base font-bold">
                    <span>Net pay</span><span>{money(payslip.netPay)}</span>
                  </div>
                </div>
              </div>
              {payslip.notes && <p className="rounded-md bg-secondary/40 p-3 text-sm"><span className="font-medium">Notes: </span>{payslip.notes}</p>}
              {payslip.paidAt && <p className="text-xs text-muted-foreground">Paid on {formatDate(payslip.paidAt)}</p>}
            </CardContent>
          </Card>
          {isManager && payslip.status !== "paid" && (
            <Card>
              <CardHeader><CardTitle>Edit Payslip</CardTitle></CardHeader>
              <CardContent>
                <PayslipEditor payslip={JSON.parse(JSON.stringify(payslip))} />
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent>
              <PayslipStatusActions id={id} status={payslip.status} isManager={isManager} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
