import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { getReports } from "@/services/accounting";
import { formatDate, money } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const reports = await getReports({
    organizationId,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined
  });
  const summaryRows = [
    { section: "Summary", metric: "Total Budget", value: reports.summary.totalBudget },
    { section: "Summary", metric: "Total Project Received", value: (reports.summary as any).totalReceived ?? 0 },
    { section: "Summary", metric: "Due", value: (reports.summary as any).dueAmount ?? 0 },
    { section: "Summary", metric: "Project Expenses", value: reports.summary.projectExpenses },
    { section: "Summary", metric: "Project Balance", value: (reports.summary as any).projectPaidBalance ?? 0 },
    { section: "Summary", metric: "General Budget", value: (reports.summary as any).generalBudget ?? 0 },
    { section: "Summary", metric: "General Expenses", value: reports.summary.generalExpenses },
    { section: "Summary", metric: "General Balance", value: (reports.summary as any).generalBudgetBalance ?? 0 },
    { section: "Summary", metric: "Total Cash Balance", value: (reports.summary as any).organizationCashBalance ?? 0 },
    { section: "Summary", metric: "Pending Approvals", value: (reports.summary as any).pendingExpenses ?? 0 }
  ];
  const projectRows = reports.projects.map((project: any) => ({
    section: "Project",
    project: `${project.name} (${project.code})`,
    budget: project.budget,
    paid: project.received,
    due: project.receivableRemaining,
    expense: project.expense,
    paidBalance: project.cashAfterExpenses
  }));
  const expenseRows = reports.expenses.map((expense: any) => ({
    section: "Expense",
    date: formatDate(expense.expenseDate),
    category: expense.category,
    project: expense.project,
    amount: expense.amount,
    description: expense.description
  }));
  if (searchParams.get("format") === "pdf") {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Accounting Report", { x: 40, y: 790, font, size: 18, color: rgb(0.06, 0.46, 0.43) });
    summaryRows.forEach((row, index) => {
      page.drawText(`${row.metric}: ${money(row.value)}`, { x: 40, y: 755 - index * 16, font, size: 10 });
    });
    reports.expenses.slice(0, 25).forEach((row: any, index: number) => {
      page.drawText(`${formatDate(row.expenseDate)} | ${row.category} | ${row.project} | ${money(row.amount)}`, { x: 40, y: 590 - index * 16, font, size: 9 });
    });
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=expense-report.pdf" } });
  }
  const csv = Papa.unparse([...summaryRows, ...projectRows, ...expenseRows]);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=expense-report.csv" } });
}
