import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetExpenseChart, SimpleBarChart, TrendChart } from "@/components/charts";
import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { Organization } from "@/models/Organization";
import { getAccountingSummary, getDashboardCharts } from "@/services/accounting";

export default async function DashboardPage() {
  const session = await requireSession();
  await connectToDatabase();
  const organizationCount = session.user.role === "super_admin" ? await Organization.countDocuments() : 0;
  const summary = session.user.organizationId
    ? await getAccountingSummary(session.user.organizationId)
    : { totalProjects: 0, activeProjects: 0, totalBudget: 0, totalReceived: 0, generalBudget: 0, projectExpenses: 0, generalExpenses: 0, totalExpenses: 0, dueAmount: 0, remainingBudget: 0, generalBudgetBalance: 0, organizationCashBalance: 0 };
  const charts = session.user.organizationId ? await getDashboardCharts(session.user.organizationId) : { byCategory: [], byProject: [], monthly: [], budgetVsExpense: [] };
  return (
    <PageShell title="Dashboard" description="Live accounting totals and expense trends.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {session.user.role === "super_admin" && <StatCard label="Total Organizations" value={organizationCount} />}
        <StatCard label="Total Projects" value={summary.totalProjects} />
        <StatCard label="Active Projects" value={summary.activeProjects} />
        <StatCard label="Total Budget" value={summary.totalBudget} currency />
        <StatCard label="Total Project Received" value={(summary as any).totalReceived ?? 0} currency />
        <StatCard label="Due" value={(summary as any).dueAmount ?? 0} currency />
        <StatCard label="General Budget" value={(summary as any).generalBudget ?? 0} currency />
        <StatCard label="Project Expenses" value={summary.projectExpenses} currency />
        <StatCard label="General Expenses" value={summary.generalExpenses} currency />
        <StatCard label="Project Balance After Expenses" value={summary.remainingBudget} currency />
        <StatCard label="General Balance" value={(summary as any).generalBudgetBalance ?? 0} currency />
        <StatCard label="Total Cash Balance" value={(summary as any).organizationCashBalance ?? 0} currency />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {((summary as any).pendingExpenses ?? 0) > 0 && <AlertCard text={`${(summary as any).pendingExpenses} expenses pending approval`} />}
        {((summary as any).projectPaidBalance ?? 0) < 0 && <AlertCard text="Project expenses are higher than project payments" />}
        {((summary as any).generalBudgetBalance ?? 0) < 0 && <AlertCard text="General expenses are higher than general funds" />}
      </div>
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
