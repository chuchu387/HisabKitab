import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Organization } from "@/models/Organization";
import { getDerivedLedger } from "@/services/accounts";
import { getFinancialStatements } from "@/services/financial-statements";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const [statements, organization] = await Promise.all([getFinancialStatements({
    organizationId,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined
  }), Organization.findById(organizationId).select("name").lean() as any]);
  const statement = searchParams.get("statement") ?? "all";
  const ledger = statement === "trial_balance" || statement === "closing" || statement === "all"
    ? await getDerivedLedger(organizationId, statements.period.from, statements.period.to)
    : null;
  const rows = statementRows(statement, statements, ledger);

  if (searchParams.get("format") === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([595, 842]);
    drawHeader(page, bold, font, organization?.name ?? "No company name", exportTitle(statement), statements.period.label);
    let y = 735;
    if (statement === "profit_loss") {
      drawSection(page, bold, font, "Profit and Loss", statements.profitAndLoss.map((row) => [row.account, formatAmount(row.amount)]), y);
    } else if (statement === "trial_balance") {
      drawSection(page, bold, font, "Trial Balance", (ledger?.summary ?? []).map((row: any) => [`${row.accountCode} ${row.accountName}`, `Dr ${formatAmount(row.debit)} / Cr ${formatAmount(row.credit)}`]), y);
    } else {
      y = drawSection(page, bold, font, "Closing Summary", closingSummaryRows(statements), y);
      y = drawSection(page, bold, font, "Balance Sheet", balanceSheetRows(statements), y - 18);
      drawSection(page, bold, font, "Profit and Loss", statements.profitAndLoss.map((row) => [row.account, formatAmount(row.amount)]), y - 18);
    }
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=${fileName(statement, "pdf")}` } });
  }

  const csv = Papa.unparse(rows);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=${fileName(statement, "csv")}` } });
}

function statementRows(statement: string, statements: any, ledger: any) {
  const summaryRows = Object.entries(statements.summary).map(([metric, value]) => ({ section: "Summary", account: metric, debit: "", credit: "", amount: value }));
  const balanceRows = [
    ...statements.balanceSheet.assets.map((row: any) => ({ section: "Balance Sheet - Assets", account: row.account, debit: row.amount, credit: "", amount: row.amount })),
    ...statements.balanceSheet.liabilities.map((row: any) => ({ section: "Balance Sheet - Liabilities", account: row.account, debit: "", credit: row.amount, amount: row.amount })),
    ...statements.balanceSheet.equity.map((row: any) => ({ section: "Balance Sheet - Equity", account: row.account, debit: "", credit: row.amount, amount: row.amount }))
  ];
  const profitRows = statements.profitAndLoss.map((row: any) => ({ section: "Profit and Loss", account: row.account, debit: row.amount < 0 ? Math.abs(row.amount) : "", credit: row.amount > 0 ? row.amount : "", amount: row.amount }));
  const trialRows = (ledger?.summary ?? []).map((row: any) => ({ section: "Trial Balance", account: `${row.accountCode} - ${row.accountName}`, debit: row.debit, credit: row.credit, amount: row.balance }));
  const cashRows = statements.cashFlow.map((row: any) => ({ section: "Cash Flow", account: row.account, debit: "", credit: "", amount: row.amount }));
  const receivableRows = statements.receivables.map((row: any) => ({ section: "Accounts Receivable", account: `${row.projectName} (${row.projectCode})`, debit: row.due, credit: "", amount: row.due }));
  if (statement === "balance_sheet") return [...summaryRows.filter((row) => ["totalAssets", "totalLiabilities", "ownerEquity", "cashAtBank", "accountsReceivable"].includes(row.account)), ...balanceRows, ...receivableRows];
  if (statement === "profit_loss") return profitRows;
  if (statement === "trial_balance") return trialRows;
  if (statement === "cash_flow") return cashRows;
  if (statement === "closing") return [...summaryRows, ...profitRows, ...balanceRows, ...trialRows, ...cashRows, ...receivableRows];
  return [
    ...Object.entries(statements.summary).map(([metric, value]) => ({ section: "Summary", account: metric, debit: "", credit: "", amount: value })),
    ...statements.balanceSheet.assets.map((row: any) => ({ section: "Balance Sheet - Assets", account: row.account, debit: row.amount, credit: "", amount: row.amount })),
    ...statements.balanceSheet.liabilities.map((row: any) => ({ section: "Balance Sheet - Liabilities", account: row.account, debit: "", credit: row.amount, amount: row.amount })),
    ...statements.balanceSheet.equity.map((row: any) => ({ section: "Balance Sheet - Equity", account: row.account, debit: "", credit: row.amount, amount: row.amount })),
    ...statements.profitAndLoss.map((row: any) => ({ section: "Profit and Loss", account: row.account, debit: row.amount < 0 ? Math.abs(row.amount) : "", credit: row.amount > 0 ? row.amount : "", amount: row.amount })),
    ...statements.cashFlow.map((row: any) => ({ section: "Cash Flow", account: row.account, debit: "", credit: "", amount: row.amount })),
    ...statements.receivables.map((row: any) => ({ section: "Accounts Receivable", account: `${row.projectName} (${row.projectCode})`, debit: row.due, credit: "", amount: row.due }))
  ];
}

function drawHeader(page: any, bold: any, font: any, company: string, title: string, period: string) {
  page.drawText(company, { x: 40, y: 790, font: bold, size: 14, color: rgb(0.06, 0.46, 0.43) });
  page.drawText(title, { x: 40, y: 772, font, size: 10 });
  page.drawText(period, { x: 40, y: 756, font, size: 9 });
}

function drawSection(page: any, bold: any, font: any, title: string, rows: string[][], startY: number) {
  page.drawText(title, { x: 40, y: startY, font: bold, size: 12 });
  let y = startY - 20;
  for (const [label, amount] of rows) {
    page.drawText(label.slice(0, 65), { x: 50, y, font: amount ? font : bold, size: 9 });
    if (amount) page.drawText(amount, { x: 455, y, font, size: 9 });
    y -= 15;
    if (y < 70) break;
  }
  return y;
}

function balanceSheetRows(statements: any) {
  return [
    ["Assets", ""],
    ...statements.balanceSheet.assets.map((row: any) => [row.account, formatAmount(row.amount)]),
    ["Total Assets", formatAmount(statements.summary.totalAssets)],
    ["Liabilities", ""],
    ...statements.balanceSheet.liabilities.map((row: any) => [row.account, formatAmount(row.amount)]),
    ["Total Liabilities", formatAmount(statements.summary.totalLiabilities)],
    ["Equity", ""],
    ...statements.balanceSheet.equity.map((row: any) => [row.account, formatAmount(row.amount)]),
    ["Total Equity", formatAmount(statements.summary.ownerEquity)]
  ];
}

function closingSummaryRows(statements: any) {
  return [
    ["Revenue", formatAmount(statements.summary.revenue)],
    ["Total Expenses", formatAmount(statements.summary.totalExpenses)],
    ["Net Profit / Loss After Tax", formatAmount(statements.summary.netProfitAfterTax)],
    ["Cash / Bank At Close", formatAmount(statements.summary.cashAtBank)],
    ["Accounts Receivable At Close", formatAmount(statements.summary.accountsReceivable)]
  ];
}

function exportTitle(statement: string) {
  const titles: Record<string, string> = {
    balance_sheet: "Balance Sheet",
    profit_loss: "Profit and Loss",
    trial_balance: "Trial Balance",
    closing: "Fiscal Year Closing Report"
  };
  return titles[statement] ?? "Financial Statements";
}

function fileName(statement: string, ext: string) {
  return `${statement || "financial-statements"}.${ext}`;
}

function formatAmount(value: number) {
  if (value < 0) return `(${money(Math.abs(value)).replace("Rs. ", "")})`;
  return money(value).replace("Rs. ", "");
}
