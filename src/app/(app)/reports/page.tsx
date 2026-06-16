import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ReportVisuals } from "@/features/reports/report-visuals";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { getReports } from "@/services/accounting";

export default async function ReportsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const filters = { organizationId, from: params?.from, to: params?.to, projectId: params?.projectId, categoryId: params?.categoryId };
  const reports = await getReports(filters);
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => typeof v === "string")) as Record<string, string>);
  return (
    <PageShell title="Reports" description="Summary, project, and expense reports with CSV/PDF exports.">
      <form className="flex flex-wrap gap-2">
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" defaultValue={params?.from} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" defaultValue={params?.to} />
        <Button variant="outline">Filter</Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Budget" value={reports.summary.totalBudget} currency />
        <StatCard label="Total Paid" value={(reports.summary as any).totalReceived ?? 0} currency />
        <StatCard label="Due" value={(reports.summary as any).dueAmount ?? 0} currency />
        <StatCard label="Project Expenses" value={reports.summary.projectExpenses} currency />
        <StatCard label="Project Paid Balance" value={(reports.summary as any).projectPaidBalance ?? 0} currency />
        <StatCard label="General Budget" value={(reports.summary as any).generalBudget ?? 0} currency />
        <StatCard label="General Expenses" value={reports.summary.generalExpenses} currency />
        <StatCard label="General Balance" value={(reports.summary as any).generalBudgetBalance ?? 0} currency />
        <StatCard label="Total Cash Balance" value={(reports.summary as any).organizationCashBalance ?? 0} currency />
      </div>
      <ReportVisuals
        categorySummary={JSON.parse(JSON.stringify(reports.categorySummary))}
        monthlySummary={JSON.parse(JSON.stringify(reports.monthlySummary))}
        expenseTypeSummary={JSON.parse(JSON.stringify(reports.expenseTypeSummary))}
        projects={JSON.parse(JSON.stringify(reports.projects))}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Project Report</h2>
        <DataTable data={reports.projects} columns={[
          { header: "Project", cell: (p: any) => `${p.name} (${p.code})` },
          { header: "Budget", cell: (p: any) => money(p.budget) },
          { header: "Total Paid", cell: (p: any) => money(p.received ?? 0) },
          { header: "Due", cell: (p: any) => money(p.receivableRemaining ?? 0) },
          { header: "Expense", cell: (p: any) => money(p.expense) },
          { header: "Paid Balance", cell: (p: any) => money(p.cashAfterExpenses ?? 0) }
        ]} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Expense Report</h2>
        <DataTable data={reports.expenses} columns={[
          { header: "Date", cell: (e: any) => formatDate(e.expenseDate) },
          { header: "Category", cell: (e: any) => e.category },
          { header: "Project", cell: (e: any) => e.project },
          { header: "Amount", cell: (e: any) => money(e.amount) }
        ]} />
      </section>
    </PageShell>
  );
}
