import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ExpenseForm } from "@/features/forms/expense-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";

export default async function EditExpensePage({ params }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const [expense, categories, projects] = await Promise.all([
    Expense.findOne({ _id: params.id, organizationId }).lean(),
    ExpenseCategory.find({ organizationId, active: true }).sort({ name: 1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean()
  ]);
  if (!expense) notFound();
  return <PageShell title="Edit Expense" breadcrumb={[{ label: "Expenses", href: "/expenses" }, { label: "Edit" }]}><ExpenseForm expense={JSON.parse(JSON.stringify(expense))} categories={JSON.parse(JSON.stringify(categories))} projects={JSON.parse(JSON.stringify(projects))} /></PageShell>;
}
