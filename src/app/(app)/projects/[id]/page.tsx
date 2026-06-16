import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { getProjectFinancials } from "@/services/accounting";

export default async function ProjectDetailPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const financials = await getProjectFinancials(organizationId, params.id);
  if (!financials.project) notFound();
  return (
    <PageShell title={financials.project.name} description={financials.project.description} breadcrumb={[{ label: "Projects", href: "/projects" }, { label: financials.project.name }]}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Budget" value={financials.project.totalBudget} currency />
        <StatCard label="Total Paid" value={financials.received} currency />
        <StatCard label="Due" value={financials.receivableRemaining} currency />
        <StatCard label="Total Expense" value={financials.expense} currency />
        <StatCard label="Paid Balance After Expenses" value={financials.cashAfterExpenses} currency />
      </div>
    </PageShell>
  );
}
