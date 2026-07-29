import { DataTable } from "@/components/data-table";
import { FiscalYearLockWarning } from "@/components/fiscal-year-lock-warning";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ManualJournalForm } from "@/features/forms/manual-journal-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { ManualJournalEntry } from "@/models/ManualJournalEntry";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

export default async function JournalEntriesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const query: any = { organizationId };
  if (fyRange.from || fyRange.to) {
    query.entryDate = {};
    if (fyRange.from) query.entryDate.$gte = fyRange.from;
    if (fyRange.to) {
      const end = fyRange.to;
      end.setHours(23, 59, 59, 999);
      query.entryDate.$lte = end;
    }
  }
  const journals = await ManualJournalEntry.find(query).sort({ entryDate: -1 }).lean();
  const lines = journals.flatMap((journal: any) => (journal.lines ?? []).map((line: any) => ({ ...line, voucherNumber: journal.voucherNumber, entryDate: journal.entryDate, fiscalYearLabel: fiscalYearLabelForDate(journal.entryDate), memo: journal.memo, id: journal._id.toString() })));
  return (
    <PageShell title="Manual Journal Entries" description="Owner-only accounting adjustments for depreciation, accruals, corrections, and tax adjustments.">
      <FiscalYearLockWarning organizationId={organizationId} />
      <ManualJournalForm />
      <FilterForm className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={params?.from ?? ""} />
        <input className="native-control" type="date" name="to" defaultValue={params?.to ?? ""} />
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <DataTable data={lines} pagination={{ basePath: "/journal-entries", searchParams: params }} columns={[
        { header: "Date", cell: (line: any) => formatDate(line.entryDate) },
        { header: "Voucher", cell: (line: any) => line.voucherNumber || "-" },
        { header: "FY", cell: (line: any) => line.fiscalYearLabel },
        { header: "Memo", cell: (line: any) => line.memo },
        { header: "Account", cell: (line: any) => `${line.accountCode} ${line.accountName}` },
        { header: "Debit", cell: (line: any) => money(line.debit ?? 0) },
        { header: "Credit", cell: (line: any) => money(line.credit ?? 0) }
      ]} />
    </PageShell>
  );
}
