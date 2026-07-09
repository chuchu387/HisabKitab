import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ContributorCharts } from "@/features/expense-contributors/contributor-charts";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { getExpenseContributorDetail } from "@/services/accounting";

export default async function ExpenseContributorDetailPage({ params, searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const routeParams = await params;
  const queryParams = await searchParams;
  const userId = routeParams.userId;
  if (session.user.role === "staff" && session.user.userId !== userId) redirect(`/expense-contributors/${session.user.userId}`);

  const detail = await getExpenseContributorDetail({
    organizationId,
    contributorId: userId,
    from: queryParams?.from,
    to: queryParams?.to,
    projectId: queryParams?.projectId,
    categoryId: queryParams?.categoryId,
    expenseType: queryParams?.expenseType
  });
  if (!detail.contributor) notFound();

  return (
    <PageShell title={`${(detail.contributor as any).name} Expense Profile`} description={`${(detail.contributor as any).email ?? ""} · ${(detail.contributor as any).role ?? ""}`} breadcrumb={[{ label: "Expense Contributors", href: "/expense-contributors" }, { label: (detail.contributor as any).name }]}>
      <form className="flex flex-wrap gap-2">
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" defaultValue={queryParams?.from ?? ""} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" defaultValue={queryParams?.to ?? ""} />
        <select name="expenseType" defaultValue={queryParams?.expenseType ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All expenses</option>
          <option value="project">Project only</option>
          <option value="general">General only</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Submitted" value={detail.totals.totalAmount} currency />
        <StatCard label="Expense Count" value={detail.totals.expenseCount} />
        <StatCard label="Project Expenses" value={detail.totals.projectAmount} currency />
        <StatCard label="General Expenses" value={detail.totals.generalAmount} currency />
      </div>
      <p className="text-sm text-muted-foreground">Latest expense: {formatDate(detail.totals.latestExpenseDate)}</p>
      <ContributorCharts categorySummary={JSON.parse(JSON.stringify(detail.categorySummary))} projectSummary={JSON.parse(JSON.stringify(detail.projectSummary))} monthlySummary={JSON.parse(JSON.stringify(detail.monthlySummary))} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Submitted Expenses</h2>
        <DataTable data={detail.expenses} columns={[
          { header: "Date", cell: (expense: any) => formatDate(expense.expenseDate) },
          { header: "Category", cell: (expense: any) => expense.category ?? "-" },
          { header: "Project", cell: (expense: any) => expense.project ?? "General" },
          { header: "Description", cell: (expense: any) => expense.description },
          { header: "Amount", cell: (expense: any) => money(expense.amount) }
        ]} />
      </section>
    </PageShell>
  );
}
