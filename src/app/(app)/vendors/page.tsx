import Link from "next/link";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { StatCard } from "@/components/stat-card";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { Project } from "@/models/Project";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

void Project;
void ExpenseCategory;

export default async function VendorsPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("vendorsManage");
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const vendor = typeof params?.vendor === "string" ? params.vendor : "";
  const match: any = { organizationId: new Types.ObjectId(organizationId), approvalStatus: "approved", vendorName: { $nin: ["", null] } };
  if (fyRange.from || fyRange.to) {
    match.expenseDate = {};
    if (fyRange.from) match.expenseDate.$gte = fyRange.from;
    if (fyRange.to) {
      const end = fyRange.to;
      end.setHours(23, 59, 59, 999);
      match.expenseDate.$lte = end;
    }
  }
  if (q) match.$or = [{ vendorName: new RegExp(q, "i") }, { vendorPan: new RegExp(q, "i") }];
  if (vendor) match.vendorName = vendor;
  const [summary, details] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: { name: "$vendorName", pan: "$vendorPan" }, total: { $sum: "$amount" }, vat: { $sum: "$vatAmount" }, tds: { $sum: "$tdsAmount" }, count: { $sum: 1 }, latest: { $max: "$expenseDate" } } },
      { $project: { vendorName: "$_id.name", vendorPan: "$_id.pan", total: 1, vat: 1, tds: 1, count: 1, latest: 1, _id: 0 } },
      { $sort: { total: -1 } }
    ]),
    Expense.find(match).populate("projectId categoryId createdBy").sort({ expenseDate: -1 }).limit(200).lean()
  ]);
  const totalVendorSpend = summary.reduce((sum: number, row: any) => sum + (row.total ?? 0), 0);
  const totalTds = summary.reduce((sum: number, row: any) => sum + (row.tds ?? 0), 0);
  return (
    <PageShell title="Vendor Ledger" description="Supplier-wise approved expenses, VAT, TDS, and drill-down transaction history.">
      <FilterForm className="filter-bar">
        <SearchBar placeholder="Search vendor or PAN" defaultValue={q} />
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={params?.from ?? ""} />
        <input className="native-control" type="date" name="to" defaultValue={params?.to ?? ""} />
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vendor Spend" value={totalVendorSpend} currency />
        <StatCard label="Vendors" value={summary.length} />
        <StatCard label="TDS Tracked" value={totalTds} currency />
        <StatCard label="Expense Lines" value={details.length} />
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Suppliers</h2>
        <DataTable data={summary} pagination={{ basePath: "/vendors", searchParams: params, pageParam: "vendorPage", pageSizeParam: "vendorPageSize" }} columns={[
          { header: "Vendor", cell: (row: any) => <Link className="font-medium hover:text-primary" href={`/vendors?vendor=${encodeURIComponent(row.vendorName)}&fy=${selectedFY}`}>{row.vendorName}</Link> },
          { header: "PAN", cell: (row: any) => row.vendorPan || "-" },
          { header: "Expenses", cell: (row: any) => row.count },
          { header: "VAT", cell: (row: any) => money(row.vat ?? 0) },
          { header: "TDS", cell: (row: any) => money(row.tds ?? 0) },
          { header: "Total", cell: (row: any) => money(row.total ?? 0) },
          { header: "Latest", cell: (row: any) => formatDate(row.latest) }
        ]} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{vendor ? `${vendor} Transactions` : "Recent Vendor Transactions"}</h2>
        <DataTable data={details} pagination={{ basePath: "/vendors", searchParams: params, pageParam: "detailPage", pageSizeParam: "detailPageSize" }} columns={[
          { header: "Date", cell: (row: any) => formatDate(row.expenseDate) },
          { header: "FY", cell: (row: any) => fiscalYearLabelForDate(row.expenseDate) },
          { header: "Voucher", cell: (row: any) => row.voucherNumber || "-" },
          { header: "Vendor", cell: (row: any) => row.vendorName || "-" },
          { header: "Project", cell: (row: any) => row.projectId?.name ?? "General" },
          { header: "Category", cell: (row: any) => row.categoryId?.name ?? "-" },
          { header: "Amount", cell: (row: any) => money(row.amount) },
          { header: "Added By", cell: (row: any) => row.createdBy?.name ?? "Unknown" }
        ]} />
      </section>
    </PageShell>
  );
}
