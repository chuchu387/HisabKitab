import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { getReports } from "@/services/accounting";

export default async function ReportsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const filters = { organizationId, from: searchParams?.from, to: searchParams?.to, projectId: searchParams?.projectId, categoryId: searchParams?.categoryId };
  const reports = await getReports(filters);
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(searchParams ?? {}).filter(([, v]) => typeof v === "string")) as Record<string, string>);
  return (
    <PageShell title="Reports" description="Summary, project, and expense reports with CSV/PDF exports.">
      <form className="flex flex-wrap gap-2">
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" defaultValue={searchParams?.from} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" defaultValue={searchParams?.to} />
        <Button variant="outline">Filter</Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
        <Button asChild variant="secondary"><Link href={`/api/reports/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Budget" value={reports.summary.totalBudget} currency />
        <StatCard label="Total Expenses" value={reports.summary.totalExpenses} currency />
        <StatCard label="Remaining Budget" value={reports.summary.remainingBudget} currency />
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Project Report</h2>
        <DataTable data={reports.projects} columns={[
          { header: "Project", cell: (p: any) => `${p.name} (${p.code})` },
          { header: "Budget", cell: (p: any) => money(p.budget) },
          { header: "Expense", cell: (p: any) => money(p.expense) },
          { header: "Remaining", cell: (p: any) => money(p.remaining) }
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
