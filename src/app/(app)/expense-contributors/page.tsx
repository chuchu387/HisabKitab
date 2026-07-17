import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { getExpenseContributorSummaries } from "@/services/accounting";

export default async function ExpenseContributorsPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const staffScopedUserId = session.user.role === "staff" ? session.user.userId : undefined;
  const contributors = await getExpenseContributorSummaries(organizationId, staffScopedUserId);
  const totalAmount = contributors.reduce((sum: number, row: any) => sum + (row.totalAmount ?? 0), 0);
  const totalCount = contributors.reduce((sum: number, row: any) => sum + (row.expenseCount ?? 0), 0);
  const projectAmount = contributors.reduce((sum: number, row: any) => sum + (row.projectAmount ?? 0), 0);
  const generalAmount = contributors.reduce((sum: number, row: any) => sum + (row.generalAmount ?? 0), 0);

  return (
    <PageShell title="Expense Contributors" description="Person-wise expense accountability and submitted expense profiles.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Submitted" value={totalAmount} currency />
        <StatCard label="Expense Count" value={totalCount} />
        <StatCard label="Project Expenses" value={projectAmount} currency />
        <StatCard label="General Expenses" value={generalAmount} currency />
      </div>
      <DataTable data={contributors} pagination={{ basePath: "/expense-contributors", searchParams: params }} columns={[
        { header: "User", cell: (row: any) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.email ?? "-"}</p></div> },
        { header: "Role", cell: (row: any) => <Badge>{row.role ?? "unknown"}</Badge> },
        { header: "Total", cell: (row: any) => money(row.totalAmount) },
        { header: "Project", cell: (row: any) => money(row.projectAmount) },
        { header: "General", cell: (row: any) => money(row.generalAmount) },
        { header: "Count", cell: (row: any) => row.expenseCount },
        { header: "Latest", cell: (row: any) => formatDate(row.latestExpenseDate) },
        { header: "Profile", cell: (row: any) => <Button asChild variant="outline" size="sm"><Link href={`/expense-contributors/${row.userId}`}>View</Link></Button> }
      ]} />
    </PageShell>
  );
}
