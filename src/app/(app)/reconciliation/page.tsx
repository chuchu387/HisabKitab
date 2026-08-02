import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { FiscalYearLockWarning } from "@/components/fiscal-year-lock-warning";
import { PageShell } from "@/components/page-shell";
import { ReconciliationForm } from "@/features/forms/reconciliation-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { BankAccount } from "@/models/BankAccount";
import { BankReconciliation } from "@/models/BankReconciliation";
import { getBankSystemBalances } from "@/services/reconciliation";

export default async function ReconciliationPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const throughDate = params?.date ? new Date(params.date) : new Date();
  const [bankAccounts, systemBalances, reconciliations] = await Promise.all([
    BankAccount.find({ organizationId, active: true }).sort({ name: 1 }).lean(),
    getBankSystemBalances(organizationId, throughDate),
    BankReconciliation.find({ organizationId }).populate("bankAccountId createdBy").sort({ statementDate: -1 }).limit(100).lean()
  ]);
  return (
    <PageShell title="Bank Reconciliation" description="Match system cash/bank balances against real bank statements and keep an audit trail.">
      <FiscalYearLockWarning organizationId={organizationId} />
      <ReconciliationForm bankAccounts={JSON.parse(JSON.stringify(bankAccounts))} />
      <FilterForm className="filter-bar">
        <input type="date" className="native-control" name="date" defaultValue={params?.date ?? ""} />
        <button className="inline-flex h-10 items-center justify-center rounded-md border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary">Check Balance</button>
      </FilterForm>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">System Balance By Account</h2>
        <DataTable data={systemBalances} pagination={{ basePath: "/reconciliation", searchParams: params, pageParam: "balancePage", pageSizeParam: "balancePageSize" }} columns={[
          { header: "Account", cell: (row) => row.name },
          { header: "Opening", cell: (row) => money(row.openingBalance) },
          { header: "Inflows", cell: (row) => money(row.inflow) },
          { header: "Outflows", cell: (row) => money(row.outflow) },
          { header: "System Balance", cell: (row) => money(row.balance) }
        ]} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reconciliation History</h2>
        <DataTable data={reconciliations} pagination={{ basePath: "/reconciliation", searchParams: params, pageParam: "historyPage", pageSizeParam: "historyPageSize" }} columns={[
          { header: "Voucher", cell: (row: any) => row.voucherNumber || "-" },
          { header: "Date", cell: (row: any) => formatDate(row.statementDate) },
          { header: "Account", cell: (row: any) => row.bankAccountId?.name ?? "-" },
          { header: "System", cell: (row: any) => money(row.systemBalance) },
          { header: "Statement", cell: (row: any) => money(row.statementBalance) },
          { header: "Difference", cell: (row: any) => money(row.difference) },
          { header: "CSV Match", cell: (row: any) => row.importedRowCount ? `${row.matchedRowCount}/${row.importedRowCount}` : "-" },
          { header: "Status", cell: (row: any) => <Badge variant={row.difference === 0 ? "success" : "warning"}>{row.difference === 0 ? "Matched" : "Review"}</Badge> },
          { header: "By", cell: (row: any) => row.createdBy?.name ?? "Unknown" },
          { header: "Note", cell: (row: any) => <div className="max-w-md space-y-1"><p>{row.note || "-"}</p><UnmatchedRows rows={row.importedRows ?? []} /></div> }
        ]} />
      </section>
    </PageShell>
  );
}

function UnmatchedRows({ rows }: { rows: any[] }) {
  const unmatched = rows.filter((row) => !row.matched).slice(0, 5);
  if (!unmatched.length) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer text-accent">View unmatched rows</summary>
      <div className="mt-1 space-y-1">
        {unmatched.map((row, index) => (
          <p key={index}>{formatDate(row.date)} · {row.direction} · {money(row.amount)} · {row.description || row.reference || "No description"}</p>
        ))}
      </div>
    </details>
  );
}
