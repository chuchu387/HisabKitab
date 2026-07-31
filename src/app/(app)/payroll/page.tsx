import Link from "next/link";
import { Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/stat-card";
import { generatePayroll } from "@/actions/payroll";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Payroll } from "@/models/Payroll";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date();
  date.setMonth(date.getMonth() - index);
  return { value: date.toISOString().slice(0, 7), label: date.toLocaleString("default", { month: "long", year: "numeric" }) };
});

const statusBadge: Record<string, "default" | "success" | "warning"> = { draft: "warning", approved: "default", paid: "success" };

export default async function PayrollPage({ searchParams }: any) {
  await requireFeature("payrollView");
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const month = typeof params?.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : MONTH_OPTIONS[0].value;
  const status = typeof params?.status === "string" ? params.status : "";
  const isManager = ["owner", "admin"].includes(session.user.role);
  const query: any = { organizationId, month };
  if (status) query.status = status;
  if (session.user.role === "staff") query.userId = session.user.userId;

  const [payslips, totals] = await Promise.all([
    Payroll.find(query).populate("userId", "name").sort({ createdAt: 1 }).lean(),
    Payroll.aggregate([
      { $match: { organizationId, month } },
      {
        $group: {
          _id: null,
          grossTotal: { $sum: "$grossPay" },
          netTotal: { $sum: "$netPay" },
          pendingCount: { $sum: { $cond: [{ $ne: ["$status", "paid"] }, 1, 0] } }
        }
      }
    ])
  ]);
  const total = totals[0];

  return (
    <PageShell
      title="Payroll"
      action={isManager ? (
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><Link href="/payroll/settings"><Settings2 className="h-4 w-4" />Salary Settings</Link></Button>
          <Button asChild><Link href={`/payroll/generate?month=${month}`}><Sparkles className="h-4 w-4" />Generate</Link></Button>
        </div>
      ) : null}
    >
      <form className="filter-bar" method="get">
        <select className="native-control" name="month" defaultValue={month}>
          {MONTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className="native-control" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Payslips" value={payslips.length} />
        <StatCard label="Gross Total" value={total?.grossTotal ?? 0} currency />
        <StatCard label="Net Payable" value={total?.netTotal ?? 0} currency />
        <StatCard label="Pending Payment" value={total?.pendingCount ?? 0} />
      </div>
      {payslips.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {payslips.map((payslip: any) => (
            <Card key={payslip._id.toString()} className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/payroll/${payslip._id}`} className="font-semibold hover:text-primary">{payslip.userId?.name ?? "Unknown"}</Link>
                  <Badge variant={statusBadge[payslip.status] ?? "default"}>{payslip.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Gross: <b className="text-foreground">{money(payslip.grossPay)}</b></span>
                  <span>Deductions: <b className="text-foreground">{money(payslip.totalDeductions)}</b></span>
                  <span>Attendance: <b className="text-foreground">{payslip.presentDays}/{payslip.workingDays} days</b></span>
                  <span>Commission: <b className="text-foreground">{money(payslip.commission)}</b></span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="text-xs text-muted-foreground">Net Pay</span>
                  <span className="font-bold">{money(payslip.netPay)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No payslips" description={isManager ? `No payslips for ${MONTH_OPTIONS.find((option) => option.value === month)?.label}. Generate payroll to get started.` : "No payslips for this month."} action={isManager ? <Button asChild><Link href={`/payroll/generate?month=${month}`}><Sparkles className="h-4 w-4" />Generate payroll</Link></Button> : undefined} />
      )}
    </PageShell>
  );
}
