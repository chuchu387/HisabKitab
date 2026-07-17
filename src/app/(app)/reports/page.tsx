import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ReportVisuals } from "@/features/reports/report-visuals";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Project } from "@/models/Project";
import { getReports } from "@/services/accounting";

export default async function ReportsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const filters = {
    organizationId,
    from: typeof params?.from === "string" ? params.from : undefined,
    to: typeof params?.to === "string" ? params.to : undefined,
    projectId: typeof params?.projectId === "string" ? params.projectId : undefined,
    categoryId: typeof params?.categoryId === "string" ? params.categoryId : undefined
  };
  const [reports, projects, categories] = await Promise.all([
    getReports(filters),
    Project.find({ organizationId }).sort({ name: 1 }).select("name code").lean(),
    ExpenseCategory.find({ organizationId }).sort({ name: 1 }).select("name").lean()
  ]);
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => typeof v === "string")) as Record<string, string>);
  const periodLabel = filters.from || filters.to ? `${filters.from ?? "Start"} to ${filters.to ?? "Today"}` : "All time";
  const now = new Date();
  const thisMonth = new URLSearchParams({ from: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateInput(now) });
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonth = new URLSearchParams({ from: dateInput(lastMonthStart), to: dateInput(lastMonthEnd) });
  return (
    <PageShell title="Reports" description="Summary, project, and expense reports with CSV/PDF exports.">
      <form className="flex flex-wrap gap-2">
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" defaultValue={filters.from} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" defaultValue={filters.to} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" name="projectId" defaultValue={filters.projectId ?? ""}>
          <option value="">All projects</option>
          {projects.map((project: any) => <option key={String(project._id)} value={String(project._id)}>{project.name} ({project.code})</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" name="categoryId" defaultValue={filters.categoryId ?? ""}>
          <option value="">All categories</option>
          {categories.map((category: any) => <option key={String(category._id)} value={String(category._id)}>{category.name}</option>)}
        </select>
        <Button variant="outline">Filter</Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
        <Button asChild variant="ghost"><Link href="/reports">Reset</Link></Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!filters.from && !filters.to ? "secondary" : "outline"}><Link href="/reports">All Time</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/reports?${thisMonth}`}>This Month</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/reports?${lastMonth}`}>Last Month</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Budget" value={reports.summary.totalBudget} currency />
        <StatCard label="Total Project Received" value={(reports.summary as any).totalReceived ?? 0} currency />
        <StatCard label="Due" value={(reports.summary as any).dueAmount ?? 0} currency />
        <StatCard label="Client Project Expenses" value={(reports.summary as any).clientProjectExpenses ?? 0} currency />
        <StatCard label="Internal Project Expenses" value={(reports.summary as any).internalProjectExpenses ?? 0} currency />
        <StatCard label="All Project Expenses" value={reports.summary.projectExpenses} currency />
        <StatCard label="Company Project Cash Balance" value={(reports.summary as any).projectPaidBalance ?? 0} currency />
        <StatCard label="Owner/Other Funds" value={(reports.summary as any).generalBudget ?? 0} currency />
        <StatCard label="General Expenses" value={reports.summary.generalExpenses} currency />
        <StatCard label="Company Cash Balance" value={(reports.summary as any).organizationCashBalance ?? 0} currency />
        <StatCard label="Pending Approvals" value={(reports.summary as any).pendingExpenses ?? 0} />
      </div>
      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-3">
          <ReportSummaryBlock title="Money In" rows={[
            ["Project payments received", (reports.summary as any).totalReceived ?? 0],
            ["Owner/other funds", (reports.summary as any).generalBudget ?? 0]
          ]} />
          <ReportSummaryBlock title="Money Out" rows={[
            ["Client project expenses", (reports.summary as any).clientProjectExpenses ?? 0],
            ["Internal project expenses", (reports.summary as any).internalProjectExpenses ?? 0],
            ["General expenses", reports.summary.generalExpenses]
          ]} />
          <div className="rounded-md border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">Report period</p>
            <p className="font-semibold">{periodLabel}</p>
            <p className="mt-4 text-sm text-muted-foreground">Net company cash</p>
            <p className="text-2xl font-semibold">{money((reports.summary as any).organizationCashBalance ?? 0)}</p>
          </div>
        </CardContent>
      </Card>
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
          { header: "Type", cell: (p: any) => p.projectType === "internal" ? "Internal" : "Client" },
          { header: "Budget", cell: (p: any) => money(p.budget) },
          { header: "Received", cell: (p: any) => money(p.received ?? 0) },
          { header: "Due", cell: (p: any) => money(p.receivableRemaining ?? 0) },
          { header: "Expense", cell: (p: any) => money(p.expense) },
          { header: "Project Balance", cell: (p: any) => money(p.cashAfterExpenses ?? 0) }
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
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold">Export Report</h2>
            <p className="text-sm text-muted-foreground">Exports use the current filters and report period.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary"><Link href={`/api/reports/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
            <Button asChild variant="secondary"><Link href={`/api/reports/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ReportSummaryBlock({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div className="rounded-md border p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{money(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
