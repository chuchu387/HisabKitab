import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetExpenseChart, DonutChart, SimpleBarChart, TrendChart } from "@/components/charts";
import { FilterForm } from "@/components/filter-form";
import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { dateInput } from "@/lib/utils";
import { money } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { Organization } from "@/models/Organization";
import { getAccountingSummary, getDashboardCharts } from "@/services/accounting";
import { getFinancialStatements } from "@/services/financial-statements";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter } from "@/services/fiscal-year-filter";

export default async function DashboardPage({ searchParams }: any) {
  const session = await requireSession();
  await connectToDatabase();
  const params = await searchParams;
  const organizationCount = session.user.role === "super_admin" ? await Organization.countDocuments() : 0;
  const savedFiscalYears = session.user.organizationId ? await FiscalYear.find({ organizationId: session.user.organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean() : [];
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : (fiscalYearOptions[0]?.value ?? "all");
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const filters = {
    from: fyRange.from ? dateInput(fyRange.from) : undefined,
    to: fyRange.to ? dateInput(fyRange.to) : undefined
  };
  const baseSummary = session.user.organizationId
    ? await getAccountingSummary(session.user.organizationId, filters)
    : { totalProjects: 0, activeProjects: 0, totalBudget: 0, totalReceived: 0, generalBudget: 0, projectExpenses: 0, clientProjectExpenses: 0, internalProjectExpenses: 0, generalExpenses: 0, totalExpenses: 0, dueAmount: 0, remainingBudget: 0, generalBudgetBalance: 0, organizationCashBalance: 0 };
  const statements = session.user.organizationId ? await getFinancialStatements({ organizationId: session.user.organizationId, from: filters.from, to: filters.to }) : null;
  const charts = session.user.organizationId ? await getDashboardCharts(session.user.organizationId, filters) : { byCategory: [], byProject: [], monthly: [], budgetVsExpense: [] };
  const summary = statements ? {
    ...baseSummary,
    dueAmount: statements.summary.accountsReceivable,
    organizationCashBalance: statements.summary.cashAtBank
  } : baseSummary;
  const typedSummary = summary as any;
  const periodLabel = statements?.period.label ?? "All time";
  const collectionRate = typedSummary.totalBudget > 0 ? Math.round((typedSummary.totalReceived / typedSummary.totalBudget) * 100) : 0;
  const spendRate = typedSummary.totalFunding > 0 ? Math.round((typedSummary.totalExpenses / typedSummary.totalFunding) * 100) : 0;
  const projectExpenseRate = typedSummary.totalReceived > 0 ? Math.round((typedSummary.projectExpenses / typedSummary.totalReceived) * 100) : 0;
  const fundingMix = [
    { name: "Project payments", amount: typedSummary.totalReceived ?? 0 },
    { name: "Owner/other funds", amount: typedSummary.generalBudget ?? 0 }
  ].filter((row) => row.amount > 0);
  const expenseMix = [
    { name: "Client projects", amount: typedSummary.clientProjectExpenses ?? 0 },
    { name: "Internal projects", amount: typedSummary.internalProjectExpenses ?? 0 },
    { name: "General", amount: typedSummary.generalExpenses ?? 0 }
  ].filter((row) => row.amount > 0);
  return (
    <PageShell title="Dashboard" description={`Live accounting totals and expense trends for ${periodLabel}.`}>
      <FilterForm className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="all">All fiscal years</option>
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={filters.from ?? ""} />
        <input className="native-control" type="date" name="to" defaultValue={filters.to ?? ""} />
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <span className="font-semibold">Showing:</span> {selectedFY === "all" ? "All fiscal years" : periodLabel}
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-primary/25 bg-foreground text-primary-foreground shadow-sm">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-white/65">Company Cash Balance</p>
            <p className="mt-2 text-4xl font-semibold text-white">{money(typedSummary.organizationCashBalance ?? 0)}</p>
            <p className="mt-3 max-w-2xl text-sm text-white/70">Calculated for the selected fiscal-year filter. Balance sheet-style cash can include carry-forward receivables/equity in Accounts.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <RatioPill label="Collection" value={collectionRate} />
            <RatioPill label="Spend rate" value={spendRate} danger={spendRate > 85} />
            <RatioPill label="Project spend" value={projectExpenseRate} danger={projectExpenseRate > 90} />
          </div>
        </CardContent>
      </Card>
      <DashboardSection title="Money In">
        <StatCard label="Project Payments Received" value={(summary as any).totalReceived ?? 0} currency />
        <StatCard label="Owner/Other Funds" value={(summary as any).generalBudget ?? 0} currency />
        <StatCard label="Total Funding" value={(summary as any).totalFunding ?? 0} currency />
      </DashboardSection>
      <DashboardSection title="Money Out">
        <StatCard label="Client Project Expenses" value={(summary as any).clientProjectExpenses ?? 0} currency />
        <StatCard label="Internal Project Expenses" value={(summary as any).internalProjectExpenses ?? 0} currency />
        <StatCard label="General Expenses" value={summary.generalExpenses} currency />
        <StatCard label="Total Expenses" value={(summary as any).totalExpenses ?? 0} currency />
      </DashboardSection>
      <DashboardSection title="Projects">
        {session.user.role === "super_admin" && <StatCard label="Total Organizations" value={organizationCount} />}
        <StatCard label="Total Projects" value={summary.totalProjects} />
        <StatCard label="Active Projects" value={summary.activeProjects} />
        <StatCard label="Total Budget" value={summary.totalBudget} currency />
        <StatCard label="Due" value={(summary as any).dueAmount ?? 0} currency />
        <StatCard label="Company Project Cash Balance" value={summary.remainingBudget} currency />
      </DashboardSection>
      <div className="grid gap-3 md:grid-cols-3">
        {((summary as any).pendingExpenses ?? 0) > 0 && <AlertCard text={`${(summary as any).pendingExpenses} expenses pending approval`} />}
        {((summary as any).projectPaidBalance ?? 0) < 0 && <AlertCard text="Project and internal expenses are higher than project receipts" />}
        {((summary as any).organizationCashBalance ?? 0) < 0 && <AlertCard text="Approved expenses are higher than company cash received" />}
      </div>
      <CompanyCashBreakdown summary={summary as any} />
      <FinancialHealthPanel summary={typedSummary} collectionRate={collectionRate} spendRate={spendRate} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SimpleBarChart title="Expenses By Category" data={JSON.parse(JSON.stringify(charts.byCategory))} />
        <DonutChart title="Funding Mix" data={fundingMix.length ? fundingMix : [{ name: "No funding", amount: 1 }]} />
        <DonutChart title="Expense Mix" data={expenseMix.length ? expenseMix : [{ name: "No expense", amount: 1 }]} />
        <SimpleBarChart title="Expenses By Project" data={JSON.parse(JSON.stringify(charts.byProject))} />
        <TrendChart data={JSON.parse(JSON.stringify(charts.monthly))} />
        <BudgetExpenseChart data={JSON.parse(JSON.stringify(charts.budgetVsExpense))} />
      </div>
    </PageShell>
  );
}

function AlertCard({ text }: { text: string }) {
  return <Card className="border-destructive/40 bg-destructive/5"><CardContent className="p-4 text-sm font-medium text-destructive">{text}</CardContent></Card>;
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function CompanyCashBreakdown({ summary }: { summary: any }) {
  const projectReceived = summary.totalReceived ?? 0;
  const ownerOtherFunds = summary.generalBudget ?? 0;
  const projectExpenses = summary.projectExpenses ?? 0;
  const generalExpenses = summary.generalExpenses ?? 0;
  const companyCashBalance = summary.organizationCashBalance ?? 0;
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 className="text-base font-semibold">Company Cash Breakdown</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <BreakdownItem label="Project payments received" value={projectReceived} positive />
            <BreakdownItem label="Owner/other funds" value={ownerOtherFunds} positive />
            <BreakdownItem label="All project expenses" value={projectExpenses} />
            <BreakdownItem label="General expenses" value={generalExpenses} />
          </div>
        </div>
        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          <p className="text-muted-foreground">
            {money(projectReceived)} + {money(ownerOtherFunds)} - {money(projectExpenses)} - {money(generalExpenses)}
          </p>
          <p className="mt-1 text-2xl font-semibold">{money(companyCashBalance)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialHealthPanel({ summary, collectionRate, spendRate }: { summary: any; collectionRate: number; spendRate: number }) {
  const netCash = summary.organizationCashBalance ?? 0;
  const due = summary.dueAmount ?? 0;
  const pending = summary.pendingExpenses ?? 0;
  return (
    <Card>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-4">
        <HealthItem label="Collection health" value={`${collectionRate}%`} detail={`${money(summary.totalReceived ?? 0)} received from ${money(summary.totalBudget ?? 0)} budget`} tone={collectionRate >= 75 ? "good" : collectionRate >= 40 ? "warn" : "bad"} />
        <HealthItem label="Spend pressure" value={`${spendRate}%`} detail={`${money(summary.totalExpenses ?? 0)} spent from ${money(summary.totalFunding ?? 0)} funding`} tone={spendRate <= 65 ? "good" : spendRate <= 90 ? "warn" : "bad"} />
        <HealthItem label="Receivable due" value={money(due)} detail="Client project amount not received yet" tone={due <= 0 ? "good" : "warn"} />
        <HealthItem label="Approval queue" value={String(pending)} detail="Pending expenses waiting for approval" tone={pending === 0 ? "good" : "warn"} />
        <div className="rounded-lg border bg-muted/35 p-4 lg:col-span-4">
          <p className="text-sm font-medium text-muted-foreground">Cash equation</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold text-primary">{money(summary.totalReceived ?? 0)}</span> project payments +{" "}
            <span className="font-semibold text-primary">{money(summary.generalBudget ?? 0)}</span> other funds -{" "}
            <span className="font-semibold text-destructive">{money(summary.projectExpenses ?? 0)}</span> project expenses -{" "}
            <span className="font-semibold text-destructive">{money(summary.generalExpenses ?? 0)}</span> general expenses ={" "}
            <span className={netCash >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>{money(netCash)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RatioPill({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-white/70">{label}</span>
        <span className={danger ? "font-semibold text-accent" : "font-semibold text-white"}>{value}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10">
        <div className={danger ? "h-1.5 rounded-full bg-accent" : "h-1.5 rounded-full bg-primary"} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function HealthItem({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-primary" : tone === "warn" ? "text-accent" : "text-destructive";
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function BreakdownItem({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={positive ? "font-semibold text-primary" : "font-semibold text-destructive"}>{positive ? "+" : "-"} {money(value)}</p>
    </div>
  );
}
