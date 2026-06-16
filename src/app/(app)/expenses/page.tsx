import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { BulkLinkExpensesForm } from "@/features/expenses/bulk-link-expenses-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";

export default async function ExpensesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const query: any = { organizationId };
  if (searchParams?.from || searchParams?.to) {
    query.expenseDate = {};
    if (searchParams.from) query.expenseDate.$gte = new Date(searchParams.from);
    if (searchParams.to) query.expenseDate.$lte = new Date(searchParams.to);
  }
  const [expenses, projects] = await Promise.all([
    Expense.find(query).populate("categoryId projectId").sort({ expenseDate: -1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean()
  ]);
  return (
    <PageShell title="Expenses" action={<Button asChild><Link href="/expenses/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex flex-wrap gap-2"><SearchBar placeholder="Search description" /><input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" /><input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" /><Button variant="outline">Filter</Button></form>
      {expenses.length ? (
        <BulkLinkExpensesForm expenses={JSON.parse(JSON.stringify(expenses))} projects={JSON.parse(JSON.stringify(projects))} />
      ) : (
        <EmptyState title="No expenses" description="Create an expense or adjust filters." />
      )}
    </PageShell>
  );
}
