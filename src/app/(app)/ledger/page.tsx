import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { getDerivedLedger } from "@/services/accounts";

export default async function LedgerPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const from = typeof params?.from === "string" ? params.from : undefined;
  const to = typeof params?.to === "string" ? params.to : undefined;
  const accountCode = typeof params?.accountCode === "string" ? params.accountCode : undefined;
  const ledger = await getDerivedLedger(organizationId, from, to, accountCode).catch((error) => {
    console.error("Ledger load failed", error);
    return { entries: [], summary: [], error: "Ledger could not be loaded for the selected filters." };
  }) as any;
  return (
    <PageShell title="Ledger" description="Generated double-entry debit/credit ledger from payments, funds, and approved expenses.">
      <form className="filter-bar">
        <input className="native-control" type="date" name="from" defaultValue={from} />
        <input className="native-control" type="date" name="to" defaultValue={to} />
        <input className="native-control" name="accountCode" placeholder="Account code" defaultValue={accountCode} />
        <Button variant="outline">Filter</Button>
      </form>
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
