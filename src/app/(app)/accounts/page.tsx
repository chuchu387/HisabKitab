import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { fiscalYearOptions, getFinancialStatements } from "@/services/financial-statements";

export default async function AccountsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const fyOptions = fiscalYearOptions();
  const selectedFY = typeof params?.fy === "string" ? params.fy : fyOptions[0]?.label;
  const fy = fyOptions.find((option) => option.label === selectedFY) ?? fyOptions[0];
  const filters = {
    organizationId,
    from: typeof params?.from === "string" ? params.from : fy.from,
    to: typeof params?.to === "string" ? params.to : fy.to
  };
  const statements = await getFinancialStatements(filters);
  const qs = new URLSearchParams({ from: filters.from, to: filters.to });
  const summary = statements.summary;

  return (
    <PageShell title="Accounts" description="Fiscal-year financial statements for audit, tax planning, and tax clearance preparation.">
      <form className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          {fyOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
        </select>
        <input className="native-control" type="date" name="from" defaultValue={filters.from} />
        <input className="native-control" type="date" name="to" defaultValue={filters.to} />
        <Button variant="outline">Filter</Button>
        <Button asChild variant="secondary"><Link href={`/api/accounts/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
        <Button asChild variant="secondary"><Link href={`/api/accounts/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={summary.revenue} currency />
        <StatCard label="Total Expenses" value={summary.totalExpenses} currency />
        <StatCard label="Net Profit Before Tax" value={summary.netProfitBeforeTax} currency />
        <StatCard label="Cash / Bank Balance" value={summary.cashAtBank} currency />
        <StatCard label="Accounts Receivable" value={summary.accountsReceivable} currency />
        <StatCard label="Estimated Tax Provision" value={summary.estimatedTaxPayable} currency />
        <StatCard label="Total Assets" value={summary.totalAssets} currency />
        <StatCard label="Owner Equity" value={summary.ownerEquity} currency />
      </div>

      <Card className="border-primary/20">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-3">
          <StatementNote title="Basis" value="Cash-basis operational statement" />
          <StatementNote title="Period" value={statements.period.label} />
          <StatementNote title="Tax" value="Estimated at 25%; confirm final tax with auditor" />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-3">
        <StatementCard title="Assets" rows={statements.balanceSheet.assets} totalLabel="Total Assets" total={summary.totalAssets} />
        <StatementCard title="Liabilities" rows={statements.balanceSheet.liabilities} totalLabel="Total Liabilities" total={summary.totalLiabilities} />
        <StatementCard title="Equity" rows={statements.balanceSheet.equity} totalLabel="Total Equity" total={summary.ownerEquity} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Profit & Loss</h2>
          <Badge variant={summary.netProfitAfterTax >= 0 ? "success" : "danger"}>{summary.netProfitAfterTax >= 0 ? "Profit" : "Loss"}</Badge>
        </div>
        <DataTable data={statements.profitAndLoss} pagination={{ basePath: "/accounts", searchParams: params, pageParam: "plPage", pageSizeParam: "plPageSize" }} columns={[
          { header: "Account", cell: (row: any) => row.account },
          { header: "Amount", cell: (row: any) => money(row.amount) }
        ]} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Cash Flow</h2>
          <DataTable data={statements.cashFlow} pagination={{ basePath: "/accounts", searchParams: params, pageParam: "cashPage", pageSizeParam: "cashPageSize" }} columns={[
            { header: "Movement", cell: (row: any) => row.account },
            { header: "Amount", cell: (row: any) => money(row.amount) }
          ]} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Trial Balance Summary</h2>
          <DataTable data={statements.trialBalance} pagination={{ basePath: "/accounts", searchParams: params, pageParam: "trialPage", pageSizeParam: "trialPageSize" }} columns={[
            { header: "Account", cell: (row: any) => row.account },
            { header: "Debit", cell: (row: any) => money(row.debit) },
            { header: "Credit", cell: (row: any) => money(row.credit) }
          ]} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Accounts Receivable</h2>
          <DataTable data={statements.receivables} pagination={{ basePath: "/accounts", searchParams: params, pageParam: "recvPage", pageSizeParam: "recvPageSize" }} columns={[
            { header: "Project", cell: (row: any) => `${row.projectName} (${row.projectCode})` },
            { header: "Budget", cell: (row: any) => money(row.budget) },
            { header: "Received", cell: (row: any) => money(row.received) },
            { header: "Due", cell: (row: any) => money(row.due) }
          ]} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Expense By Category</h2>
          <DataTable data={statements.expenseByCategory} pagination={{ basePath: "/accounts", searchParams: params, pageParam: "catPage", pageSizeParam: "catPageSize" }} columns={[
            { header: "Category", cell: (row: any) => row.name },
            { header: "Records", cell: (row: any) => row.count },
            { header: "Amount", cell: (row: any) => money(row.total) }
          ]} />
        </div>
      </section>
    </PageShell>
  );
}

function StatementCard({ title, rows, totalLabel, total }: { title: string; rows: Array<{ account: string; amount: number }>; totalLabel: string; total: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="font-semibold">{title}</h2>
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.account} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.account}</span>
              <span className="font-medium">{money(row.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 font-semibold">
          <span>{totalLabel}</span>
          <span>{money(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatementNote({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}
