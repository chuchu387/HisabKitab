import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";

export default async function ExpenseDetailPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const expense = (await Expense.findOne({ _id: params.id, organizationId }).populate("categoryId projectId").lean()) as any;
  if (!expense) notFound();
  return (
    <PageShell title="Expense Detail" breadcrumb={[{ label: "Expenses", href: "/expenses" }, { label: "Detail" }]}>
      <Card>
        <CardHeader><CardTitle>{expense.description}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p><strong>Date:</strong> {formatDate(expense.expenseDate)}</p>
          <p><strong>Amount:</strong> {money(expense.amount)}</p>
          <p><strong>Category:</strong> {(expense.categoryId as any)?.name}</p>
          <p><strong>Project:</strong> {(expense.projectId as any)?.name ?? "General"}</p>
          {expense.receiptImageId && <Button asChild variant="outline"><Link href={`/api/receipts/${expense.receiptImageId}`}>Download Receipt</Link></Button>}
        </CardContent>
      </Card>
    </PageShell>
  );
}
