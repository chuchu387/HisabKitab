import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { getCachedDerivedLedger } from "@/services/accounts";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

export default async function LedgerPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const from = fyRange.from ? fyRange.from.toISOString().slice(0, 10) : (selectedFY === "custom" && typeof params?.from === "string" ? params.from : undefined);
  const to = fyRange.to ? fyRange.to.toISOString().slice(0, 10) : (selectedFY === "custom" && typeof params?.to === "string" ? params.to : undefined);
  const accountCode = typeof params?.accountCode === "string" ? params.accountCode : undefined;
  const ledger = await getCachedDerivedLedger(organizationId, from, to, accountCode).catch((error) => {
    console.error("Ledger load failed", error);
    return { entries: [], summary: [], error: "Ledger could not be loaded for the selected filters." };
  }) as any;
  return (
    <PageShell title="Ledger" description="Generated double-entry debit/credit ledger from payments, funds, and approved expenses.">
      <FilterForm className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={from} />
        <input className="native-control" type="date" name="to" defaultValue={to} />
        <input className="native-control" name="accountCode" placeholder="Account code" defaultValue={accountCode} />
        <Button variant="outline">Filter</Button>
      </FilterForm>
      {ledger.error && <EmptyState title="Ledger unavailable" description={ledger.error} />}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Trial Balance</h2>
        <DataTable data={ledger.summary} pagination={{ basePath: "/ledger", searchParams: params, pageParam: "summaryPage", pageSizeParam: "summaryPageSize" }} columns={[
          { header: "Code", cell: (row: any) => row.accountCode },
          { header: "Account", cell: (row: any) => row.accountName },
          { header: "Debit", cell: (row: any) => money(row.debit) },
          { header: "Credit", cell: (row: any) => money(row.credit) },
          { header: "Balance", cell: (row: any) => money(row.balance) }
        ]} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Journal Lines</h2>
        <DataTable data={ledger.entries} pagination={{ basePath: "/ledger", searchParams: params, pageParam: "entryPage", pageSizeParam: "entryPageSize" }} columns={[
          { header: "Date", cell: (row: any) => formatDate(row.date) },
          { header: "FY", cell: (row: any) => fiscalYearLabelForDate(row.date) },
          { header: "Source", cell: (row: any) => row.sourceType },
          { header: "Account", cell: (row: any) => `${row.accountCode} ${row.accountName}` },
          { header: "Memo", cell: (row: any) => row.memo },
          { header: "Debit", cell: (row: any) => money(row.debit) },
          { header: "Credit", cell: (row: any) => money(row.credit) }
        ]} />
      </section>
    </PageShell>
  );
}
