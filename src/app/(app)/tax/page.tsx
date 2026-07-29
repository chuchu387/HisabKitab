import { Types } from "mongoose";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { dateInput, formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { GeneralFund } from "@/models/GeneralFund";
import { Invoice } from "@/models/Invoice";
import { ProjectPayment } from "@/models/ProjectPayment";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";
import { getFinancialStatements } from "@/services/financial-statements";
import { paymentAccountingStages } from "@/services/project-payment-accounting";

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
  const selectedFY = typeof params?.fy === "string" ? params.fy : (fiscalYearOptions[0]?.value ?? "all");
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
  const fundMatch: any = { organizationId: new Types.ObjectId(organizationId) };
  const invoiceMatch: any = { organizationId: new Types.ObjectId(organizationId), status: { $ne: "void" } };
  if (Object.keys(range).length) {
    expenseMatch.expenseDate = range;
    paymentMatch.paymentDate = range;
    fundMatch.fundDate = range;
    invoiceMatch.invoiceDate = range;
  }
  const [taxResult, revenueResult, fundResult, invoiceTaxResult, expensesResult, invoicesResult, paymentsResult, fundsResult, statementsResult] = await Promise.all([
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, vat: { $sum: "$vatAmount" }, tds: { $sum: "$tdsAmount" }, taxable: { $sum: { $cond: ["$taxable", "$amount", 0] } }, total: { $sum: "$amount" } } }]),
    ProjectPayment.aggregate([{ $match: paymentMatch }, ...paymentAccountingStages(), { $group: { _id: null, revenue: { $sum: "$serviceAmountForAccounting" }, cash: { $sum: "$amount" }, vat: { $sum: "$vatPortionForAccounting" } } }]),
    GeneralFund.aggregate([{ $match: fundMatch }, { $group: { _id: null, funds: { $sum: "$amount" } } }]),
    Invoice.aggregate([{ $match: invoiceMatch }, { $group: { _id: null, outputVat: { $sum: "$vatAmount" }, invoiceTotal: { $sum: "$total" }, invoiceSubtotal: { $sum: "$subtotal" } } }]),
    Expense.find(expenseMatch).populate("categoryId projectId").sort({ expenseDate: -1 }).lean(),
    Invoice.find(invoiceMatch).populate("clientId projectId").sort({ invoiceDate: -1 }).lean(),
    ProjectPayment.find(paymentMatch).populate("projectId invoiceId").sort({ paymentDate: -1 }).lean(),
    GeneralFund.find(fundMatch).sort({ fundDate: -1 }).lean(),
    getFinancialStatements({ organizationId, from, to })
  ].map((promise) => Promise.resolve(promise).then((value) => ({ ok: true as const, value })).catch((error) => ({ ok: false as const, error }))));
  if (!taxResult.ok) console.error("Tax aggregate failed", taxResult.error);
  if (!revenueResult.ok) console.error("Tax revenue failed", revenueResult.error);
  if (!fundResult.ok) console.error("Tax funds failed", fundResult.error);
  if (!invoiceTaxResult.ok) console.error("Tax invoice VAT failed", invoiceTaxResult.error);
  if (!expensesResult.ok) console.error("Tax expenses failed", expensesResult.error);
  if (!invoicesResult.ok) console.error("Tax invoices failed", invoicesResult.error);
  if (!paymentsResult.ok) console.error("Tax payments failed", paymentsResult.error);
  if (!fundsResult.ok) console.error("Tax fund records failed", fundsResult.error);
  if (!statementsResult.ok) console.error("Tax financial statements failed", statementsResult.error);
  const taxAgg = taxResult.ok ? taxResult.value as any[] : [];
  const revenueAgg = revenueResult.ok ? revenueResult.value as any[] : [];
  const fundAgg = fundResult.ok ? fundResult.value as any[] : [];
  const invoiceTaxAgg = invoiceTaxResult.ok ? invoiceTaxResult.value as any[] : [];
  const expenses = expensesResult.ok ? expensesResult.value as any[] : [];
  const invoices = invoicesResult.ok ? invoicesResult.value as any[] : [];
  const payments = paymentsResult.ok ? paymentsResult.value as any[] : [];
  const funds = fundsResult.ok ? fundsResult.value as any[] : [];
  const statements = statementsResult.ok ? statementsResult.value as Awaited<ReturnType<typeof getFinancialStatements>> : null;
  const tax = taxAgg[0] ?? { vat: 0, tds: 0, taxable: 0, total: 0 };
  const invoiceTax = invoiceTaxAgg[0] ?? { outputVat: 0, invoiceTotal: 0, invoiceSubtotal: 0 };
  const revenue = revenueAgg[0]?.revenue ?? 0;
  const cashReceived = revenueAgg[0]?.cash ?? revenue;
  const founderFunds = fundAgg[0]?.funds ?? 0;
  const profitBeforeTax = statements?.summary.netProfitBeforeTax ?? (revenue - tax.total);
  const cashMovementAfterFunds = cashReceived + founderFunds - (tax.total ?? 0);
  const estimatedIncomeTax = Math.max(profitBeforeTax, 0) * 0.25;
  const netVatPayable = (invoiceTax.outputVat ?? 0) - (tax.vat ?? 0);
  const periodLabel = selectedFY === "all" ? "All fiscal years" : (statements?.period.label ?? "Selected period");
  const records = [
    ...invoices.map((invoice: any) => ({
      date: invoice.invoiceDate,
      fyDate: invoice.invoiceDate,
      type: "Invoice",
      party: invoice.clientId?.name ?? invoice.projectId?.name ?? "-",
      reference: invoice.invoiceNumber,
      description: invoice.projectId?.name ?? invoice.notes ?? "Client invoice",
      debit: 0,
      credit: invoice.subtotal ?? 0,
      outputVat: invoice.vatAmount ?? 0,
      inputVat: 0,
      tds: 0
    })),
    ...payments.map((payment: any) => ({
      date: payment.paymentDate,
      fyDate: payment.paymentDate,
      type: "Payment",
      party: payment.projectId?.name ?? "-",
      reference: payment.voucherNumber || payment.invoiceId?.invoiceNumber || "-",
      description: payment.note || "Client payment received",
      debit: payment.amount ?? 0,
      credit: 0,
      outputVat: 0,
      inputVat: 0,
      tds: 0
    })),
    ...funds.map((fund: any) => ({
      date: fund.fundDate,
      fyDate: fund.fundDate,
      type: "Founder/Company Fund",
      party: "Owner / Founder",
      reference: fund.voucherNumber || "-",
      description: fund.note || "Company fund added",
      debit: 0,
      credit: fund.amount ?? 0,
      outputVat: 0,
      inputVat: 0,
      tds: 0
    })),
    ...expenses.map((expense: any) => ({
      date: expense.expenseDate,
      fyDate: expense.expenseDate,
      type: "Expense",
      party: expense.vendorName || expense.projectId?.name || expense.categoryId?.name || "-",
      reference: expense.billNumber || expense.voucherNumber || "-",
      description: expense.description,
      debit: expense.amount ?? 0,
      credit: 0,
      outputVat: 0,
      inputVat: expense.vatAmount ?? 0,
      tds: expense.tdsAmount ?? 0
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return (
    <PageShell title="Tax Summary" description="VAT, TDS, taxable expense, and estimated income tax summary for audit preparation.">
      <FilterForm className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="all">All fiscal years</option>
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={from} />
        <input className="native-control" type="date" name="to" defaultValue={to} />
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-1 p-4 text-sm">
          <p><span className="font-semibold">Showing:</span> {periodLabel}</p>
          <p className="text-muted-foreground">Founder/company funds are funding entries, not taxable revenue. Operating profit or loss is client payments minus approved expenses; cash movement after funds includes founder/company money added.</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={revenue} currency />
        <StatCard label={profitBeforeTax >= 0 ? "Operating Profit Before Tax" : "Operating Loss Before Tax"} value={profitBeforeTax} currency />
        <StatCard label="Founder/Company Funds Added" value={founderFunds} currency />
        <StatCard label="Cash Movement After Funds" value={cashMovementAfterFunds} currency />
        <StatCard label="Output VAT" value={invoiceTax.outputVat ?? 0} currency />
        <StatCard label="Input VAT" value={tax.vat} currency />
        <StatCard label={netVatPayable >= 0 ? "Net VAT Payable" : "VAT Credit"} value={Math.abs(netVatPayable)} currency />
        <StatCard label="TDS" value={tax.tds} currency />
        <StatCard label="Estimated Income Tax" value={estimatedIncomeTax} currency />
      </div>
      <DataTable data={records} pagination={{ basePath: "/tax", searchParams: params }} columns={[
        { header: "Date", cell: (record: any) => formatDate(record.date) },
        { header: "FY", cell: (record: any) => fiscalYearLabelForDate(record.fyDate) },
        { header: "Type", cell: (record: any) => record.type },
        { header: "Party/Account", cell: (record: any) => record.party },
        { header: "Reference", cell: (record: any) => record.reference },
        { header: "Description", cell: (record: any) => record.description },
        { header: "Money In", cell: (record: any) => record.credit ? money(record.credit) : "-" },
        { header: "Money Out", cell: (record: any) => record.debit ? money(record.debit) : "-" },
        { header: "Output VAT", cell: (record: any) => money(record.outputVat ?? 0) },
        { header: "Input VAT", cell: (record: any) => money(record.inputVat ?? 0) },
        { header: "TDS", cell: (record: any) => money(record.tds ?? 0) }
      ]} />
    </PageShell>
  );
}
