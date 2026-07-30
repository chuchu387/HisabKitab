import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { toggleFiscalYearStatus } from "@/actions/fiscal-years";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { dateInput, formatDate, isObjectId, money } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { getDerivedLedger } from "@/services/accounts";
import { getFinancialStatements } from "@/services/financial-statements";
import { emptyFinancialStatements, emptyLedger } from "@/services/statement-fallback";

export default async function FiscalYearClosingPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const year = await FiscalYear.findOne({ _id: routeParams.id, organizationId }).lean();
  if (!year) notFound();
  const from = dateInput((year as any).startDate);
  const to = dateInput((year as any).endDate);
  const [statementsResult, ledgerResult] = await Promise.all([
    getFinancialStatements({ organizationId, from, to }),
    getDerivedLedger(organizationId, from, to)
  ].map((promise) => Promise.resolve(promise).then((value) => ({ ok: true as const, value })).catch((error) => ({ ok: false as const, error }))));
  if (!statementsResult.ok) console.error("Fiscal year closing statements failed", statementsResult.error);
  if (!ledgerResult.ok) console.error("Fiscal year closing ledger failed", ledgerResult.error);
  const statements = (statementsResult.ok ? statementsResult.value : emptyFinancialStatements(from, to)) as any;
  const ledger = (ledgerResult.ok ? ledgerResult.value : emptyLedger()) as any;
  const snapshot = (year as any).closingSnapshot;
  const debit = ledger.summary.reduce((sum: number, row: any) => sum + (row.debit ?? 0), 0);
  const credit = ledger.summary.reduce((sum: number, row: any) => sum + (row.credit ?? 0), 0);
  const difference = Number((debit - credit).toFixed(2));
  const cashMovementAfterFunds = Number(((statements.summary.bankOpeningBalance ?? 0) + (statements.summary.cashReceived ?? statements.summary.revenue) + statements.summary.ownerFunds - statements.summary.totalExpenses).toFixed(2));
  const isClosed = (year as any).status === "closed";
  return (
    <PageShell title={`${(year as any).name} Closing`} description="Review core statements, download closing reports, then lock the fiscal year after audit checks are complete.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={statements.summary.revenue} currency />
        <StatCard label="Expenses" value={statements.summary.totalExpenses} currency />
        <StatCard label={statements.summary.netProfitAfterTax >= 0 ? "Net Profit" : "Net Loss"} value={statements.summary.netProfitAfterTax} currency />
        <StatCard label="Trial Difference" value={difference} currency />
      </div>
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{(year as any).name}</h2>
              <Badge variant={isClosed ? "danger" : "success"}>{(year as any).status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate((year as any).startDate)} to {formatDate((year as any).endDate)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link href={`/api/accounts/export?format=csv&statement=closing&from=${from}&to=${to}&fiscalYearId=${routeParams.id}`}>Closing CSV</Link></Button>
            <Button asChild variant="secondary"><Link href={`/api/accounts/export?format=pdf&statement=closing&from=${from}&to=${to}&fiscalYearId=${routeParams.id}`}>Closing PDF</Link></Button>
            <form action={toggleFiscalYearStatus}>
              <input type="hidden" name="id" value={(year as any)._id.toString()} />
              <input type="hidden" name="status" value={isClosed ? "open" : "closed"} />
              <ConfirmButton label={isClosed ? "Reopen FY" : "Close FY"} title={isClosed ? "Reopen fiscal year?" : "Close fiscal year?"} description="Closed fiscal years prevent transaction edits inside this period." />
            </form>
          </div>
        </div>
      </section>
      {snapshot && (
        <section className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm shadow-sm">
          <h2 className="font-semibold">Frozen Closing Snapshot Saved</h2>
          <p className="mt-1 text-muted-foreground">This fiscal year has a saved audit snapshot generated at {formatDate(snapshot.generatedAt)}. Downloaded closing reports should be compared against this snapshot if later data changes are made after reopening.</p>
        </section>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChecklistItem title="Trial balance is balanced" ok={difference === 0} detail={`Debit ${money(debit)} · Credit ${money(credit)} · Difference ${money(difference)}`} />
        <ChecklistItem title="Profit and loss generated" ok detail={`${statements.summary.netProfitAfterTax >= 0 ? "Net profit" : "Net loss"} ${money(statements.summary.netProfitAfterTax)} · founder/company funds are not revenue`} />
        <ChecklistItem title="Cash movement after funds" ok={cashMovementAfterFunds >= 0} detail={`${money(statements.summary.bankOpeningBalance ?? 0)} bank opening + ${money(statements.summary.cashReceived ?? statements.summary.revenue)} client payment cash + ${money(statements.summary.ownerFunds)} founder/company funds - ${money(statements.summary.totalExpenses)} expenses = ${money(cashMovementAfterFunds)}`} />
        <ChecklistItem title="Balance sheet generated" ok detail={`Assets ${money(statements.summary.totalAssets)} · Equity ${money(statements.summary.ownerEquity)}`} />
        <ChecklistItem title="Receivables reviewed" ok detail={`Outstanding client receivable ${money(statements.summary.accountsReceivable)}`} />
      </section>
    </PageShell>
  );
}

function ChecklistItem({ title, ok, detail }: { title: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant={ok ? "success" : "danger"}>{ok ? "Ready" : "Review"}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
