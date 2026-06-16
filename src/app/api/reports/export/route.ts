import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { getReports } from "@/services/accounting";
import { formatDate } from "@/lib/utils";

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
  const rows = reports.expenses.map((expense: any) => ({
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
    page.drawText("Expense Report", { x: 40, y: 790, font, size: 18, color: rgb(0.06, 0.46, 0.43) });
    rows.slice(0, 35).forEach((row, index) => {
      page.drawText(`${row.date} | ${row.category} | ${row.project} | ${row.amount}`, { x: 40, y: 750 - index * 18, font, size: 10 });
    });
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=expense-report.pdf" } });
  }
  const csv = Papa.unparse(rows);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=expense-report.csv" } });
}
