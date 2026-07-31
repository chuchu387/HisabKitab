import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money, safeDate } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { Invoice } from "@/models/Invoice";
import { ProjectPayment } from "@/models/ProjectPayment";
import { paymentAccountingStages } from "@/services/project-payment-accounting";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const range = dateRange(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);
  const oid = new Types.ObjectId(organizationId);
  const invoiceMatch: any = { organizationId: oid, status: { $ne: "void" } };
  const expenseMatch: any = { organizationId: oid, approvalStatus: "approved" };
  const paymentMatch: any = { organizationId: oid };
  if (range) {
    invoiceMatch.invoiceDate = range;
    expenseMatch.expenseDate = range;
    paymentMatch.paymentDate = range;
  }
  const [invoiceAgg, expenseAgg, paymentAgg, invoices, expenses] = await Promise.all([
    Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, subtotal: { $sum: "$subtotal" }, outputVat: { $sum: "$vatAmount" }, total: { $sum: "$total" } } }]),
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, inputVat: { $sum: "$vatAmount" }, tds: { $sum: "$tdsAmount" }, expense: { $sum: "$amount" } } }]),
    ProjectPayment.aggregate([{ $match: paymentMatch }, ...paymentAccountingStages(), { $group: { _id: null, cash: { $sum: "$amount" }, service: { $sum: "$serviceAmountForAccounting" }, vatCollected: { $sum: "$vatPortionForAccounting" } } }]),
    Invoice.find(invoiceMatch).populate("clientId projectId").sort({ invoiceDate: -1 }).lean(),
    Expense.find(expenseMatch).populate("categoryId projectId").sort({ expenseDate: -1 }).lean()
  ]);
  const outputVat = invoiceAgg[0]?.outputVat ?? 0;
  const inputVat = expenseAgg[0]?.inputVat ?? 0;
  const netVat = outputVat - inputVat;
  const summaryRows = [
    { section: "Summary", metric: "Invoice Subtotal / Service Revenue", value: invoiceAgg[0]?.subtotal ?? 0 },
    { section: "Summary", metric: "Payment Cash Received", value: paymentAgg[0]?.cash ?? 0 },
    { section: "Summary", metric: "Payment Service Portion", value: paymentAgg[0]?.service ?? 0 },
    { section: "Summary", metric: "Output VAT Invoiced", value: outputVat },
    { section: "Summary", metric: "Output VAT Collected", value: paymentAgg[0]?.vatCollected ?? 0 },
    { section: "Summary", metric: "Input VAT", value: inputVat },
    { section: "Summary", metric: netVat >= 0 ? "Net VAT Payable" : "VAT Credit", value: Math.abs(netVat) },
    { section: "Summary", metric: "TDS", value: expenseAgg[0]?.tds ?? 0 }
  ];
  const invoiceRows = (invoices as any[]).map((invoice) => ({
    section: "Sales Invoice",
    date: formatDate(invoice.invoiceDate),
    reference: invoice.invoiceNumber,
    party: invoice.clientId?.name ?? "-",
    project: invoice.projectId?.name ?? "-",
    subtotal: invoice.subtotal,
    outputVat: invoice.vatAmount,
    total: invoice.total,
    status: invoice.status
  }));
  const expenseRows = (expenses as any[]).map((expense) => ({
    section: "Purchase/Expense Bill",
    date: formatDate(expense.expenseDate),
    reference: expense.billNumber || expense.voucherNumber || "-",
    party: expense.vendorName || expense.categoryId?.name || "-",
    project: expense.projectId?.name ?? "General",
    amount: expense.amount,
    inputVat: expense.vatAmount ?? 0,
    tds: expense.tdsAmount ?? 0
  }));
  if (searchParams.get("format") === "pdf") {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText("VAT Report", { x: 40, y: 790, font: bold, size: 18, color: rgb(0.06, 0.46, 0.43) });
    summaryRows.forEach((row, index) => page.drawText(`${row.metric}: ${money(row.value)}`, { x: 40, y: 755 - index * 16, font, size: 10 }));
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=vat-report.pdf" } });
  }
  const csv = Papa.unparse([...summaryRows, ...invoiceRows, ...expenseRows]);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=vat-report.csv" } });
}

function dateRange(from?: string, to?: string) {
  const range: Record<string, Date> = {};
  const start = safeDate(from);
  const end = safeDate(to);
  if (start) range.$gte = start;
  if (end) {
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
}
