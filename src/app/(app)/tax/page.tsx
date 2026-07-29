import { Types } from "mongoose";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { dateInput, formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { ProjectPayment } from "@/models/ProjectPayment";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

export default async function TaxPage({ searchParams }: any) {
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
  if (Object.keys(range).length) {
    expenseMatch.expenseDate = range;
    paymentMatch.paymentDate = range;
  }
  const [taxAgg, revenueAgg, expenses] = await Promise.all([
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, vat: { $sum: "$vatAmount" }, tds: { $sum: "$tdsAmount" }, taxable: { $sum: { $cond: ["$taxable", "$amount", 0] } }, total: { $sum: "$amount" } } }]),
    ProjectPayment.aggregate([{ $match: paymentMatch }, { $group: { _id: null, revenue: { $sum: "$amount" } } }]),
    Expense.find(expenseMatch).populate("categoryId projectId").sort({ expenseDate: -1 }).lean()
  ]);
  const tax = taxAgg[0] ?? { vat: 0, tds: 0, taxable: 0, total: 0 };
  const revenue = revenueAgg[0]?.revenue ?? 0;
  const profitBeforeTax = revenue - tax.total;
  const estimatedIncomeTax = Math.max(profitBeforeTax, 0) * 0.25;
  return (
    <PageShell title="Tax Summary" description="VAT, TDS, taxable expense, and estimated income tax summary for audit preparation.">
      <form className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={from} />
        <input className="native-control" type="date" name="to" defaultValue={to} />
        <Button variant="outline">Filter</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={revenue} currency />
        <StatCard label="Expense VAT" value={tax.vat} currency />
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
