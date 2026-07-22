import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { ExpenseApprovalHistory } from "@/models/ExpenseApprovalHistory";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

void ExpenseCategory;
void Project;
void User;

export default async function ExpenseDetailPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const routeParams = await params;
  const [expense, history] = await Promise.all([
    Expense.findOne({ _id: routeParams.id, organizationId }).populate("categoryId projectId createdBy").lean() as any,
    ExpenseApprovalHistory.find({ expenseId: routeParams.id, organizationId }).populate("userId").sort({ createdAt: -1 }).lean()
  ]);
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
          <p><strong>Added By:</strong> {(expense.createdBy as any)?.name ?? "Unknown"}</p>
          <p><strong>Approval:</strong> {expense.approvalStatus ?? "pending"}</p>
          {expense.receiptImageId && <Button asChild variant="outline"><Link href={`/api/receipts/${expense.receiptImageId}`}>Download Receipt</Link></Button>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Approval History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {history.length ? history.map((item: any) => (
            <div key={item._id.toString()} className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.approvalStatus}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>
              <p className="mt-1 text-muted-foreground">By {item.userId?.name ?? "Unknown"}</p>
              {item.note && <p className="mt-2">{item.note}</p>}
            </div>
          )) : <p className="text-sm text-muted-foreground">No approval history yet.</p>}
        </CardContent>
      </Card>
    </PageShell>
  );
}
