import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteExpense } from "@/actions/expenses";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";

export default async function ExpensesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const query: any = { organizationId };
  if (searchParams?.from || searchParams?.to) {
    query.expenseDate = {};
    if (searchParams.from) query.expenseDate.$gte = new Date(searchParams.from);
    if (searchParams.to) query.expenseDate.$lte = new Date(searchParams.to);
  }
  const expenses = await Expense.find(query).populate("categoryId projectId").sort({ expenseDate: -1 }).lean();
  return (
    <PageShell title="Expenses" action={<Button asChild><Link href="/expenses/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex flex-wrap gap-2"><SearchBar placeholder="Search description" /><input className="h-10 rounded-md border px-3 text-sm" type="date" name="from" /><input className="h-10 rounded-md border px-3 text-sm" type="date" name="to" /><Button variant="outline">Filter</Button></form>
      <DataTable data={expenses} columns={[
        { header: "Date", cell: (e: any) => formatDate(e.expenseDate) },
        { header: "Category", cell: (e: any) => e.categoryId?.name ?? "-" },
        { header: "Project", cell: (e: any) => e.projectId?.name ?? "General" },
        { header: "Description", cell: (e: any) => <Link className="font-medium hover:text-primary" href={`/expenses/${e._id}`}>{e.description}</Link> },
        { header: "Amount", cell: (e: any) => money(e.amount) },
        { header: "Actions", cell: (e: any) => <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/expenses/${e._id}/edit`}>Edit</Link></Button><form action={deleteExpense}><input type="hidden" name="id" value={e._id.toString()} /><ConfirmButton /></form></div> }
      ]} />
    </PageShell>
  );
}
