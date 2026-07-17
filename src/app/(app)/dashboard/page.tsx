import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetExpenseChart, SimpleBarChart, TrendChart } from "@/components/charts";
import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Organization } from "@/models/Organization";
import { getAccountingSummary, getDashboardCharts } from "@/services/accounting";

export default async function DashboardPage() {
  const session = await requireSession();
  await connectToDatabase();
  const organizationCount = session.user.role === "super_admin" ? await Organization.countDocuments() : 0;
  const summary = session.user.organizationId
    ? await getAccountingSummary(session.user.organizationId)
    : { totalProjects: 0, activeProjects: 0, totalBudget: 0, totalReceived: 0, generalBudget: 0, projectExpenses: 0, clientProjectExpenses: 0, internalProjectExpenses: 0, generalExpenses: 0, totalExpenses: 0, dueAmount: 0, remainingBudget: 0, generalBudgetBalance: 0, organizationCashBalance: 0 };
  const charts = session.user.organizationId ? await getDashboardCharts(session.user.organizationId) : { byCategory: [], byProject: [], monthly: [], budgetVsExpense: [] };
  return (
    <PageShell title="Dashboard" description="Live accounting totals and expense trends.">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Company Cash Balance</p>
          <p className="mt-1 text-3xl font-semibold text-primary">{money((summary as any).organizationCashBalance ?? 0)}</p>
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
      <div className="grid gap-4 xl:grid-cols-2">
        <SimpleBarChart title="Expenses By Category" data={JSON.parse(JSON.stringify(charts.byCategory))} />
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

function BreakdownItem({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={positive ? "font-semibold text-primary" : "font-semibold text-destructive"}>{positive ? "+" : "-"} {money(value)}</p>
    </div>
  );
}
