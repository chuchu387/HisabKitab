import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ProjectTasksPanel } from "@/features/projects/project-tasks-panel";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, isObjectId, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { ProjectTask } from "@/models/ProjectTask";
import { TaskFolder } from "@/models/TaskFolder";
import { User } from "@/models/User";
import { getProjectFinancials } from "@/services/accounting";

void ExpenseCategory;
void User;

export default async function ProjectDetailPage({ params, searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const routeParams = await params;
  const queryParams = await searchParams;
  const projectId = routeParams.id;
  if (!isObjectId(projectId)) notFound();
  const [financials, projectExpenses, tasks, folders, assignees, currentUser] = await Promise.all([
    getProjectFinancials(organizationId, projectId),
    Expense.find({ organizationId, projectId }).populate("categoryId createdBy").sort({ expenseDate: -1 }).lean(),
    ProjectTask.find({ organizationId, projectId }).populate("folderId assigneeId assigneeIds createdBy comments.userId activity.userId").sort({ createdAt: -1 }).lean(),
    TaskFolder.find({ organizationId, active: true, projectIds: projectId }).populate("projectIds createdBy").sort({ name: 1 }).lean(),
    User.find({ organizationId, active: true, role: { $in: ["admin", "staff"] } }).sort({ name: 1 }).lean(),
    User.findOne({ _id: session.user.userId, organizationId }).select("taskPermissions").lean()
  ]);
  if (!financials.project) notFound();
  const canManage = ["owner", "admin"].includes(session.user.role);
  const fallbackTaskPermissions = session.user.role === "staff"
    ? { canCreateTask: true, canAssignTask: false, canCreateFolder: false, canManageFolderProjects: false }
    : { canCreateTask: true, canAssignTask: true, canCreateFolder: true, canManageFolderProjects: true };
  const taskPermissions = session.user.role === "owner" ? fallbackTaskPermissions : { ...fallbackTaskPermissions, ...((currentUser as any)?.taskPermissions ?? {}) };
  return (
    <PageShell
      title={financials.project.name}
      description={financials.project.description}
      breadcrumb={[{ label: "Projects", href: "/projects" }, { label: financials.project.name }]}
      action={canManage ? <Button asChild><Link href={`/projects/${projectId}/edit`}>Edit Project</Link></Button> : null}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Budget" value={financials.project.totalBudget} currency />
        <StatCard label="Total Received" value={financials.received} currency />
        <StatCard label="Due" value={financials.receivableRemaining} currency />
        <StatCard label="Total Expense" value={financials.expense} currency />
        <StatCard label="Project Balance After Expenses" value={financials.cashAfterExpenses} currency />
      </div>
      <p className="text-sm text-muted-foreground">
        {financials.project.projectType === "internal" ? "Internal project funded from company cash" : "Client project funded by project receipts"} · Created by {(financials.project.createdBy as any)?.name ?? "Unknown"}
        {(financials.project.clientId as any)?.name && <> · Client <Link className="text-primary hover:underline" href={`/clients/${(financials.project.clientId as any)._id}`}>{(financials.project.clientId as any).name}</Link></>}
      </p>
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-base font-semibold">Project Cash Breakdown</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground">Received</p><p className="font-semibold text-primary">+ {money(financials.received)}</p></div>
              <div><p className="text-muted-foreground">Approved expenses</p><p className="font-semibold text-destructive">- {money(financials.expense)}</p></div>
              <div><p className="text-muted-foreground">Pending expenses</p><p className="font-semibold">{money(financials.pendingExpenseAmount)}</p></div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="text-muted-foreground">{money(financials.received)} - {money(financials.expense)}</p>
            <p className="mt-1 text-2xl font-semibold">{money(financials.cashAfterExpenses)}</p>
          </div>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Project Expenses</h2>
          <p className="text-sm text-muted-foreground">Expenses linked to this project only. Approved expenses are used in the project spent total.</p>
        </div>
        <DataTable data={JSON.parse(JSON.stringify(projectExpenses))} pagination={{ basePath: `/projects/${projectId}`, searchParams: queryParams }} columns={[
          { header: "Date", cell: (expense: any) => formatDate(expense.expenseDate) },
          { header: "Category", cell: (expense: any) => expense.categoryId?.name ?? "-" },
          { header: "Description", cell: (expense: any) => expense.description },
          { header: "Amount", cell: (expense: any) => money(expense.amount) },
          { header: "Status", cell: (expense: any) => expense.approvalStatus ?? "pending" },
          { header: "Added By", cell: (expense: any) => expense.createdBy?.name ?? "Unknown" },
          { header: "Open", cell: (expense: any) => <Button asChild variant="outline" size="sm"><Link href={`/expenses/${expense._id}`}>View</Link></Button> }
        ]} />
      </section>
      <ProjectTasksPanel projectId={projectId} tasks={JSON.parse(JSON.stringify(tasks))} folders={JSON.parse(JSON.stringify(folders))} assignees={JSON.parse(JSON.stringify(assignees))} currentRole={session.user.role} taskPermissions={taskPermissions} />
    </PageShell>
  );
}
