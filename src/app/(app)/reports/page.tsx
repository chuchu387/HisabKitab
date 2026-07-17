import Link from "next/link";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
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
  const summary = reports.summary as any;
  const collectionRate = summary.totalBudget > 0 ? Math.round((summary.totalReceived / summary.totalBudget) * 100) : 0;
  const spendRate = summary.totalFunding > 0 ? Math.round((summary.totalExpenses / summary.totalFunding) * 100) : 0;
  const topCategories = [...reports.categorySummary].slice(0, 5);
  const topProjects = [...reports.projects].sort((a: any, b: any) => (b.expense ?? 0) - (a.expense ?? 0)).slice(0, 5);
  return (
    <PageShell title="Reports" description="Summary, project, and expense reports with CSV/PDF exports.">
      <form className="filter-bar">
        <input className="native-control" type="date" name="from" defaultValue={filters.from} />
        <input className="native-control" type="date" name="to" defaultValue={filters.to} />
        <select className="native-control" name="projectId" defaultValue={filters.projectId ?? ""}>
          <option value="">All projects</option>
          {projects.map((project: any) => <option key={String(project._id)} value={String(project._id)}>{project.name} ({project.code})</option>)}
        </select>
        <select className="native-control" name="categoryId" defaultValue={filters.categoryId ?? ""}>
          <option value="">All categories</option>
          {categories.map((category: any) => <option key={String(category._id)} value={String(category._id)}>{category.name}</option>)}
        </select>
        <Button variant="outline">Filter</Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
        <Button asChild variant="ghost"><Link href="/reports">Reset</Link></Button>
      </form>
      <div className="filter-bar">
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
      <Card className="overflow-hidden border-primary/25 shadow-sm">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_1fr]">
          <ReportKpi label="Collection Rate" value={`${collectionRate}%`} detail={`${money(summary.totalReceived ?? 0)} received from ${money(summary.totalBudget ?? 0)}`} positive={collectionRate >= 70} />
          <ReportKpi label="Spend Rate" value={`${spendRate}%`} detail={`${money(summary.totalExpenses ?? 0)} spent from ${money(summary.totalFunding ?? 0)} funding`} positive={spendRate <= 75} inverted />
          <ReportKpi label="Net Cash" value={money(summary.organizationCashBalance ?? 0)} detail="Company cash after all approved expenses" positive={(summary.organizationCashBalance ?? 0) >= 0} />
        </CardContent>
      </Card>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard title="Top Expense Categories" rows={topCategories.map((row: any) => ({ label: row.name, value: row.amount, detail: `${row.count} records` }))} />
        <RankingCard title="Highest Spending Projects" rows={topProjects.map((row: any) => ({ label: `${row.name} (${row.code})`, value: row.expense, detail: `${money(row.received ?? 0)} received` }))} />
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Project Report</h2>
        <DataTable data={reports.projects} pagination={{ basePath: "/reports", searchParams: params, pageParam: "projectPage", pageSizeParam: "projectPageSize" }} columns={[
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
        <DataTable data={reports.expenses} pagination={{ basePath: "/reports", searchParams: params, pageParam: "expensePage", pageSizeParam: "expensePageSize" }} columns={[
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

function ReportKpi({ label, value, detail, positive, inverted = false }: { label: string; value: string; detail: string; positive: boolean; inverted?: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? "text-primary" : inverted ? "text-accent" : "text-destructive";
  return (
    <div className="rounded-lg border bg-muted/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: Array<{ label: string; value: number; detail: string }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="font-semibold">{title}</h2>
        <div className="mt-4 space-y-3">
          {rows.length ? rows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="font-semibold">{money(row.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No report data for the selected filters.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
