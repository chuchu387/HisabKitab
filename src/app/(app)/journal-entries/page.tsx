import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { ManualJournalForm } from "@/features/forms/manual-journal-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { ManualJournalEntry } from "@/models/ManualJournalEntry";

export default async function JournalEntriesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const params = await searchParams;
  const journals = await ManualJournalEntry.find({ organizationId }).sort({ entryDate: -1 }).lean();
  const lines = journals.flatMap((journal: any) => (journal.lines ?? []).map((line: any) => ({ ...line, entryDate: journal.entryDate, memo: journal.memo, id: journal._id.toString() })));
  return (
    <PageShell title="Manual Journal Entries" description="Owner-only accounting adjustments for depreciation, accruals, corrections, and tax adjustments.">
      <ManualJournalForm />
      <DataTable data={lines} pagination={{ basePath: "/journal-entries", searchParams: params }} columns={[
        { header: "Date", cell: (line: any) => formatDate(line.entryDate) },
        { header: "Memo", cell: (line: any) => line.memo },
        { header: "Account", cell: (line: any) => `${line.accountCode} ${line.accountName}` },
        { header: "Debit", cell: (line: any) => money(line.debit ?? 0) },
        { header: "Credit", cell: (line: any) => money(line.credit ?? 0) }
      ]} />
    </PageShell>
  );
}
