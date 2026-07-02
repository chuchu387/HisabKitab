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
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

void ExpenseCategory;
void User;

export default async function ExpensesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const query: any = { organizationId };
  const q = params?.q ?? "";
  if (q) query.description = new RegExp(q, "i");
  if (params?.from || params?.to) {
    query.expenseDate = {};
    if (params.from) query.expenseDate.$gte = new Date(params.from);
    if (params.to) query.expenseDate.$lte = new Date(params.to);
  }
  const [expenses, projects] = await Promise.all([
    Expense.find(query).populate("categoryId projectId createdBy").sort({ expenseDate: -1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean()
  ]);
  return (
    <PageShell title="Expenses" action={<Button asChild><Link href="/expenses/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex flex-wrap gap-2">
        <SearchBar placeholder="Search description" defaultValue={q} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" defaultValue={params?.from ?? ""} />
        <input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" defaultValue={params?.to ?? ""} />
        <Button variant="outline">Filter</Button>
      </form>
      {expenses.length ? (
        <BulkLinkExpensesForm expenses={JSON.parse(JSON.stringify(expenses))} projects={JSON.parse(JSON.stringify(projects))} />
      ) : (
        <EmptyState title="No expenses" description="Create an expense or adjust filters." />
      )}
    </PageShell>
  );
}
