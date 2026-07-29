import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { getFinancialStatements } from "@/services/financial-statements";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const statements = await getFinancialStatements({
    organizationId,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined
  });
  const rows = [
    ...Object.entries(statements.summary).map(([metric, value]) => ({ section: "Summary", account: metric, debit: "", credit: "", amount: value })),
    ...statements.balanceSheet.assets.map((row) => ({ section: "Balance Sheet - Assets", account: row.account, debit: row.amount, credit: "", amount: row.amount })),
    ...statements.balanceSheet.liabilities.map((row) => ({ section: "Balance Sheet - Liabilities", account: row.account, debit: "", credit: row.amount, amount: row.amount })),
    ...statements.balanceSheet.equity.map((row) => ({ section: "Balance Sheet - Equity", account: row.account, debit: "", credit: row.amount, amount: row.amount })),
    ...statements.profitAndLoss.map((row) => ({ section: "Profit and Loss", account: row.account, debit: row.amount < 0 ? Math.abs(row.amount) : "", credit: row.amount > 0 ? row.amount : "", amount: row.amount })),
    ...statements.cashFlow.map((row) => ({ section: "Cash Flow", account: row.account, debit: "", credit: "", amount: row.amount })),
    ...statements.receivables.map((row) => ({ section: "Accounts Receivable", account: `${row.projectName} (${row.projectCode})`, debit: row.due, credit: "", amount: row.due }))
  ];

  if (searchParams.get("format") === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([595, 842]);
    page.drawText("HisabKitab Financial Statements", { x: 40, y: 790, font: bold, size: 18, color: rgb(0.06, 0.46, 0.43) });
    page.drawText(statements.period.label, { x: 40, y: 768, font, size: 10 });
    const summaryRows = [
      ["Revenue", statements.summary.revenue],
      ["Total Expenses", statements.summary.totalExpenses],
      ["Net Profit Before Tax", statements.summary.netProfitBeforeTax],
      ["Estimated Tax Provision", statements.summary.estimatedTaxPayable],
      ["Cash / Bank Balance", statements.summary.cashAtBank],
      ["Accounts Receivable", statements.summary.accountsReceivable],
      ["Total Assets", statements.summary.totalAssets],
      ["Owner Equity", statements.summary.ownerEquity]
    ];
    summaryRows.forEach(([label, value], index) => {
      page.drawText(`${label}: ${money(Number(value))}`, { x: 40, y: 735 - index * 18, font, size: 10 });
    });
    page.drawText("Balance Sheet", { x: 40, y: 560, font: bold, size: 13 });
    [...statements.balanceSheet.assets, ...statements.balanceSheet.liabilities, ...statements.balanceSheet.equity].slice(0, 18).forEach((row, index) => {
      page.drawText(`${row.account}: ${money(row.amount)}`, { x: 40, y: 535 - index * 16, font, size: 9 });
    });
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=financial-statements.pdf" } });
  }

  const csv = Papa.unparse(rows);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=financial-statements.csv" } });
}
