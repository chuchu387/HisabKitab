import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { GeneralFund } from "@/models/GeneralFund";
import { Invoice } from "@/models/Invoice";
import { ProjectPayment } from "@/models/ProjectPayment";
import { getDerivedLedger } from "@/services/accounts";
import { getDataHealth } from "@/services/data-health";
import { getFinancialStatements } from "@/services/financial-statements";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const dateQuery = dateRange(from, to);
  const [statements, ledger, health, invoices, payments, funds, expenses] = await Promise.all([
    getFinancialStatements({ organizationId, from, to }),
    getDerivedLedger(organizationId, from, to),
    getDataHealth(organizationId),
    Invoice.find({ organizationId, ...(dateQuery ? { invoiceDate: dateQuery } : {}) }).populate("clientId projectId").sort({ invoiceDate: 1 }).lean(),
    ProjectPayment.find({ organizationId, ...(dateQuery ? { paymentDate: dateQuery } : {}) }).populate("projectId invoiceId bankAccountId createdBy").sort({ paymentDate: 1 }).lean(),
    GeneralFund.find({ organizationId, ...(dateQuery ? { fundDate: dateQuery } : {}) }).populate("bankAccountId createdBy").sort({ fundDate: 1 }).lean(),
    Expense.find({ organizationId, ...(dateQuery ? { expenseDate: dateQuery } : {}) }).populate("categoryId projectId bankAccountId createdBy").sort({ expenseDate: 1 }).lean()
  ]);
  const rows = [
    ...section("Summary", Object.entries(statements.summary).map(([metric, value]) => ({ metric, value }))),
    ...section("Balance Sheet Assets", statements.balanceSheet.assets),
    ...section("Balance Sheet Liabilities", statements.balanceSheet.liabilities),
    ...section("Balance Sheet Equity", statements.balanceSheet.equity),
    ...section("Profit and Loss", statements.profitAndLoss),
    ...section("Cash Flow", statements.cashFlow),
    ...section("Trial Balance", statements.trialBalance),
    ...section("Ledger Summary", ledger.summary),
    ...section("Ledger Entries", ledger.entries),
    ...section("Invoices", (invoices as any[]).map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      date: formatDate(invoice.invoiceDate),
      client: invoice.clientId?.name ?? "",
      project: invoice.projectId?.name ?? "",
      subtotal: invoice.subtotal,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      due: Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0),
      status: invoice.status
    }))),
    ...section("Project Payments", (payments as any[]).map((payment) => ({
      voucherNumber: payment.voucherNumber,
      date: formatDate(payment.paymentDate),
      project: payment.projectId?.name ?? "",
      invoice: payment.invoiceId?.invoiceNumber ?? "",
      bankAccount: payment.bankAccountId?.name ?? "",
      amount: payment.amount,
      addedBy: payment.createdBy?.name ?? ""
    }))),
    ...section("Owner/Other Funds", (funds as any[]).map((fund) => ({
      voucherNumber: fund.voucherNumber,
      date: formatDate(fund.fundDate),
      bankAccount: fund.bankAccountId?.name ?? "",
      amount: fund.amount,
      note: fund.note,
      addedBy: fund.createdBy?.name ?? ""
    }))),
    ...section("Expenses", (expenses as any[]).map((expense) => ({
      voucherNumber: expense.voucherNumber,
      date: formatDate(expense.expenseDate),
      category: expense.categoryId?.name ?? "",
      project: expense.projectId?.name ?? "General",
      bankAccount: expense.bankAccountId?.name ?? "",
      vendorName: expense.vendorName,
      billNumber: expense.billNumber,
      approvalStatus: expense.approvalStatus,
      amount: expense.amount,
      vatAmount: expense.vatAmount,
      tdsAmount: expense.tdsAmount,
      addedBy: expense.createdBy?.name ?? "",
      description: expense.description
    }))),
    ...section("Data Health", health.issues)
  ];
  const csv = Papa.unparse(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=audit-bundle-${from ?? "start"}-${to ?? "today"}.csv`
    }
  });
}

function dateRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

function section(name: string, rows: any[]) {
  if (!rows.length) return [{ section: name, note: "No records" }];
  return rows.map((row) => ({ section: name, ...row }));
}
