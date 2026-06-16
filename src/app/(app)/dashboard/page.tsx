import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
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
    : { totalProjects: 0, activeProjects: 0, totalBudget: 0, projectExpenses: 0, generalExpenses: 0, totalExpenses: 0, remainingBudget: 0 };
  const charts = session.user.organizationId ? await getDashboardCharts(session.user.organizationId) : { byCategory: [], byProject: [], monthly: [], budgetVsExpense: [] };
  return (
    <PageShell title="Dashboard" description="Live accounting totals and expense trends.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {session.user.role === "super_admin" && <StatCard label="Total Organizations" value={organizationCount} />}
        <StatCard label="Total Projects" value={summary.totalProjects} />
        <StatCard label="Active Projects" value={summary.activeProjects} />
        <StatCard label="Total Budget" value={summary.totalBudget} currency />
        <StatCard label="Client Paid Till Now" value={(summary as any).totalReceived ?? 0} currency />
        <StatCard label="Project Expenses" value={summary.projectExpenses} currency />
        <StatCard label="General Expenses" value={summary.generalExpenses} currency />
        <StatCard label="Total Expenses" value={summary.totalExpenses} currency />
        <StatCard label="Remaining Budget" value={summary.remainingBudget} currency />
        <StatCard label="Receivable Remaining" value={(summary as any).receivableRemaining ?? 0} currency />
        <StatCard label="Cash After Project Expenses" value={(summary as any).cashAfterExpenses ?? 0} currency />
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
