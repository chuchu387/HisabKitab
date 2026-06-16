import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ProjectTasksPanel } from "@/features/projects/project-tasks-panel";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";
import { getProjectFinancials } from "@/services/accounting";

void User;

export default async function ProjectDetailPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const projectId = params.id;
  const [financials, tasks, assignees] = await Promise.all([
    getProjectFinancials(organizationId, projectId),
    ProjectTask.find({ organizationId, projectId }).populate("assigneeId").sort({ createdAt: -1 }).lean(),
    User.find({ organizationId, active: true, role: { $in: ["admin", "staff"] } }).sort({ name: 1 }).lean()
  ]);
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
      <ProjectTasksPanel projectId={projectId} tasks={JSON.parse(JSON.stringify(tasks))} assignees={JSON.parse(JSON.stringify(assignees))} />
    </PageShell>
  );
}
