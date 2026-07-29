import { Types } from "mongoose";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { dateInput, formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { Invoice } from "@/models/Invoice";
import { ProjectPayment } from "@/models/ProjectPayment";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

export default async function TaxPage(props: any) {
  return TaxContent(props);
}

async function TaxContent({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const from = fyRange.from ? dateInput(fyRange.from) : undefined;
  const to = fyRange.to ? dateInput(fyRange.to) : undefined;
  const range: any = {};
  if (fyRange.from) range.$gte = fyRange.from;
  if (fyRange.to) {
    const end = fyRange.to;
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  const expenseMatch: any = { organizationId: new Types.ObjectId(organizationId), approvalStatus: "approved" };
  const paymentMatch: any = { organizationId: new Types.ObjectId(organizationId) };
  const invoiceMatch: any = { organizationId: new Types.ObjectId(organizationId), status: { $ne: "void" } };
  if (Object.keys(range).length) {
    expenseMatch.expenseDate = range;
    paymentMatch.paymentDate = range;
    invoiceMatch.invoiceDate = range;
  }
  const [taxResult, revenueResult, invoiceTaxResult, expensesResult] = await Promise.all([
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, vat: { $sum: "$vatAmount" }, tds: { $sum: "$tdsAmount" }, taxable: { $sum: { $cond: ["$taxable", "$amount", 0] } }, total: { $sum: "$amount" } } }]),
    ProjectPayment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, revenue: { $sum: "$amount" } } }]),
    Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, outputVat: { $sum: "$vatAmount" }, invoiceTotal: { $sum: "$total" }, invoiceSubtotal: { $sum: "$subtotal" } } }]),
    Expense.find(expenseMatch).populate("categoryId projectId").sort({ expenseDate: -1 }).lean()
  ].map((promise) => Promise.resolve(promise).then((value) => ({ ok: true as const, value })).catch((error) => ({ ok: false as const, error }))));
  if (!taxResult.ok) console.error("Tax aggregate failed", taxResult.error);
  if (!revenueResult.ok) console.error("Tax revenue failed", revenueResult.error);
  if (!invoiceTaxResult.ok) console.error("Tax invoice VAT failed", invoiceTaxResult.error);
  if (!expensesResult.ok) console.error("Tax expenses failed", expensesResult.error);
  const taxAgg = taxResult.ok ? taxResult.value : [];
  const revenueAgg = revenueResult.ok ? revenueResult.value : [];
  const invoiceTaxAgg = invoiceTaxResult.ok ? invoiceTaxResult.value : [];
  const expenses = expensesResult.ok ? expensesResult.value : [];
  const tax = taxAgg[0] ?? { vat: 0, tds: 0, taxable: 0, total: 0 };
  const invoiceTax = invoiceTaxAgg[0] ?? { outputVat: 0, invoiceTotal: 0, invoiceSubtotal: 0 };
  const revenue = revenueAgg[0]?.revenue ?? 0;
  const profitBeforeTax = revenue - tax.total;
  const estimatedIncomeTax = Math.max(profitBeforeTax, 0) * 0.25;
  const netVatPayable = (invoiceTax.outputVat ?? 0) - (tax.vat ?? 0);
  return (
    <PageShell title="Tax Summary" description="VAT, TDS, taxable expense, and estimated income tax summary for audit preparation.">
      <FilterForm className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={from} />
        <input className="native-control" type="date" name="to" defaultValue={to} />
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={revenue} currency />
        <StatCard label="Output VAT" value={invoiceTax.outputVat ?? 0} currency />
        <StatCard label="Input VAT" value={tax.vat} currency />
        <StatCard label={netVatPayable >= 0 ? "Net VAT Payable" : "VAT Credit"} value={Math.abs(netVatPayable)} currency />
        <StatCard label="TDS" value={tax.tds} currency />
        <StatCard label="Estimated Income Tax" value={estimatedIncomeTax} currency />
      </div>
      <DataTable data={expenses} pagination={{ basePath: "/tax", searchParams: params }} columns={[
        { header: "Date", cell: (expense: any) => formatDate(expense.expenseDate) },
        { header: "FY", cell: (expense: any) => fiscalYearLabelForDate(expense.expenseDate) },
        { header: "Vendor", cell: (expense: any) => expense.vendorName || "-" },
        { header: "PAN/VAT", cell: (expense: any) => expense.vendorPan || "-" },
        { header: "Bill", cell: (expense: any) => expense.billNumber || "-" },
        { header: "Amount", cell: (expense: any) => money(expense.amount) },
        { header: "VAT", cell: (expense: any) => money(expense.vatAmount ?? 0) },
        { header: "TDS", cell: (expense: any) => money(expense.tdsAmount ?? 0) }
      ]} />
    </PageShell>
  );
}
