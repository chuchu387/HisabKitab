import { PageShell } from "@/components/page-shell";
import { ExpenseForm } from "@/features/forms/expense-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Project } from "@/models/Project";
import { BankAccount } from "@/models/BankAccount";

export default async function NewExpensePage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const [categories, projects, bankAccounts] = await Promise.all([
    ExpenseCategory.find({ organizationId, active: true }).sort({ name: 1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    BankAccount.find({ organizationId, active: true }).sort({ name: 1 }).lean()
  ]);
  return <PageShell title="Create Expense" breadcrumb={[{ label: "Expenses", href: "/expenses" }, { label: "Create" }]}><ExpenseForm categories={JSON.parse(JSON.stringify(categories))} projects={JSON.parse(JSON.stringify(projects))} bankAccounts={JSON.parse(JSON.stringify(bankAccounts))} /></PageShell>;
}
