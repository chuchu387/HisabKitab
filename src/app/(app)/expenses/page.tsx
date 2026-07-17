import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { BulkLinkExpensesForm } from "@/features/expenses/bulk-link-expenses-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

void User;

export default async function ExpensesPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const query: any = { organizationId };
  const q = params?.q ?? "";
  if (q) query.description = new RegExp(q, "i");
  if (session.user.role === "staff") {
    query.createdBy = session.user.userId;
  } else if (params?.submittedBy) {
    query.createdBy = params.submittedBy;
  }
  if (params?.from || params?.to) {
    query.expenseDate = {};
    if (params.from) query.expenseDate.$gte = new Date(params.from);
    if (params.to) query.expenseDate.$lte = new Date(params.to);
  }
  if (params?.projectId === "general") {
    query.projectId = null;
  } else if (params?.projectId) {
    query.projectId = params.projectId;
  }
  if (params?.expenseType === "project") query.projectId = { $ne: null };
  if (params?.expenseType === "general") query.projectId = null;
  if (params?.approvalStatus === "approved") query.approvalStatus = "approved";
  if (params?.approvalStatus === "pending") query.$or = [{ approvalStatus: "pending" }, { approvalStatus: { $exists: false } }];
  if (params?.approvalStatus === "rejected") query.approvalStatus = "rejected";
  if (params?.categoryId) query.categoryId = params.categoryId;
  const [expenses, projects, categories] = await Promise.all([
    Expense.find(query).populate("categoryId projectId createdBy").sort({ expenseDate: -1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    ExpenseCategory.find({ organizationId }).sort({ name: 1 }).lean()
  ]);
  const users = session.user.role === "staff" ? [] : await User.find({ organizationId, active: true }).sort({ name: 1 }).lean();
  const filteredTotal = expenses.reduce((sum: number, expense: any) => sum + (expense.amount ?? 0), 0);
  const approvedTotal = expenses
    .filter((expense: any) => expense.approvalStatus === "approved")
    .reduce((sum: number, expense: any) => sum + (expense.amount ?? 0), 0);
  const pendingTotal = expenses
    .filter((expense: any) => !expense.approvalStatus || expense.approvalStatus === "pending")
    .reduce((sum: number, expense: any) => sum + (expense.amount ?? 0), 0);
  return (
    <PageShell title="Expenses" action={<Button asChild><Link href="/expenses/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex flex-wrap gap-2">
        <SearchBar placeholder="Search description" defaultValue={q} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" defaultValue={params?.from ?? ""} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" defaultValue={params?.to ?? ""} />
        <select name="projectId" defaultValue={params?.projectId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All projects and general</option>
          <option value="general">General expenses only</option>
          {projects.map((project: any) => <option key={project._id.toString()} value={project._id.toString()}>{project.name} ({project.code})</option>)}
        </select>
        <select name="categoryId" defaultValue={params?.categoryId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">All categories</option>
          {categories.map((category: any) => <option key={category._id.toString()} value={category._id.toString()}>{category.name}</option>)}
        </select>
        {session.user.role !== "staff" && (
          <select name="submittedBy" defaultValue={params?.submittedBy ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">All submitters</option>
            {users.map((user: any) => <option key={user._id.toString()} value={user._id.toString()}>{user.name}</option>)}
          </select>
        )}
        <Button variant="outline">Filter</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <QuickFilter href="/expenses" active={!params?.approvalStatus && !params?.expenseType && !params?.projectId}>All</QuickFilter>
        <QuickFilter href="/expenses?approvalStatus=pending" active={params?.approvalStatus === "pending"}>Pending</QuickFilter>
        <QuickFilter href="/expenses?approvalStatus=approved" active={params?.approvalStatus === "approved"}>Approved</QuickFilter>
        <QuickFilter href="/expenses?expenseType=general" active={params?.expenseType === "general" || params?.projectId === "general"}>General</QuickFilter>
        <QuickFilter href="/expenses?expenseType=project" active={params?.expenseType === "project"}>Project</QuickFilter>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Filtered Expenses" value={filteredTotal} currency />
        <StatCard label="Approved Total" value={approvedTotal} currency />
        <StatCard label="Pending Total" value={pendingTotal} currency />
        <StatCard label="Expense Count" value={expenses.length} />
      </div>
      {expenses.length ? (
        <BulkLinkExpensesForm expenses={JSON.parse(JSON.stringify(expenses))} projects={JSON.parse(JSON.stringify(projects))} canApprove={["owner", "admin"].includes(session.user.role)} />
      ) : (
        <EmptyState title="No expenses" description="Create an expense or adjust filters." />
      )}
    </PageShell>
  );
}

function QuickFilter({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Button asChild variant={active ? "secondary" : "outline"} size="sm">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
