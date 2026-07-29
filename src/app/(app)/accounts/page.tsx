import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Organization } from "@/models/Organization";
import { fiscalYearOptions, getFinancialStatements } from "@/services/financial-statements";
import { getDerivedLedger } from "@/services/accounts";

type ReportRow = {
  label: string;
  amount?: number;
  debit?: number;
  credit?: number;
  net?: number;
  level?: number;
  section?: boolean;
  total?: boolean;
  href?: string;
};

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
  const [statements, organization, ledger] = await Promise.all([
    getFinancialStatements(filters),
    Organization.findById(organizationId).select("name").lean() as any,
    getDerivedLedger(organizationId, filters.from, filters.to)
  ]);
  const qs = new URLSearchParams({ from: filters.from, to: filters.to });
  const baseLedger = `/ledger?${qs}`;
  const expenseBase = `/expenses?from=${filters.from}&to=${filters.to}&approvalStatus=approved`;
  const summary = statements.summary;
  const liabilitiesAndEquity = summary.totalLiabilities + summary.ownerEquity;
  const balanceDifference = summary.totalAssets - liabilitiesAndEquity;
  const balanceRows: ReportRow[] = [
    { label: "Assets", section: true },
    { label: "Current Assets", level: 1 },
    { label: "Cash / Bank Balance", amount: summary.cashAtBank, level: 2, href: `${baseLedger}&accountCode=1000` },
    { label: "Accounts Receivable", amount: summary.accountsReceivable, level: 2, href: "#accounts-receivable" },
    ...statements.receivables.map((row: any) => ({ label: `${row.projectName} (${row.projectCode})`, amount: row.due, level: 3, href: `/projects/${row.projectId}` })),
    { label: "Total Assets", amount: summary.totalAssets, total: true },
    { label: "Liabilities & Equity", section: true },
    { label: "Current Liabilities", level: 1 },
    { label: "Estimated Tax Provision", amount: summary.estimatedTaxPayable, level: 2, href: "/tax" },
    { label: "Accounts Payable", amount: 0, level: 2 },
    { label: "Total Liabilities", amount: summary.totalLiabilities, total: true },
    { label: "Equity", level: 1 },
    { label: "Owner/Other Funds To Date", amount: statements.balanceSheet.equity[0]?.amount ?? 0, level: 2, href: "/general-funds" },
    { label: "Retained Earnings / Balancing Equity", amount: statements.balanceSheet.equity[1]?.amount ?? 0, level: 2, href: `${baseLedger}&accountCode=3000` },
    { label: "Total Equity", amount: summary.ownerEquity, total: true },
    { label: "Difference", amount: balanceDifference, total: true }
  ];
  const profitRows: ReportRow[] = [
    { label: "Revenue", section: true },
    { label: "Client Project Revenue", amount: summary.revenue, level: 1, href: "/project-payments" },
    { label: "Total Revenue", amount: summary.revenue, total: true },
    { label: "Operating Expenses", section: true },
    { label: "Direct Client Project Expenses", amount: summary.clientProjectExpenses, level: 1, href: `${expenseBase}&expenseType=project` },
    { label: "Internal Project Expenses", amount: summary.internalProjectExpenses, level: 1, href: `${expenseBase}&expenseType=project` },
    { label: "General/Admin Expenses", amount: summary.generalExpenses, level: 1, href: `${expenseBase}&expenseType=general` },
    { label: "Total Operating Expenses", amount: summary.totalExpenses, total: true },
    { label: "Gross Profit", amount: summary.grossProfit, total: true },
    { label: "Operating Profit", amount: summary.netProfitBeforeTax, total: true },
    { label: "Estimated Tax Provision", amount: -summary.estimatedTaxPayable, level: 1, href: "/tax" },
    { label: "Net Profit After Tax", amount: summary.netProfitAfterTax, total: true }
  ];
  const trialRows: ReportRow[] = ledger.summary.map((row: any) => ({
    label: `${row.accountCode} - ${row.accountName}`,
    debit: row.debit,
    credit: row.credit,
    net: row.balance,
    href: `${baseLedger}&accountCode=${row.accountCode}`
  }));
  const trialDebit = trialRows.reduce((sum, row) => sum + (row.debit ?? 0), 0);
  const trialCredit = trialRows.reduce((sum, row) => sum + (row.credit ?? 0), 0);

  return (
    <PageShell title="Accounts" description="Audit-style financial statements with clickable drilldowns to supporting records.">
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

      <StatementReport title="Balance Sheet" company={organization?.name ?? "No company name"} period={statements.period.label} columns={["Balance"]} rows={balanceRows} />
      <StatementReport title="Profit and Loss" company={organization?.name ?? "No company name"} period={statements.period.label} columns={["Amount"]} rows={profitRows} />
      <StatementReport
        title="Trial Balance"
        company={organization?.name ?? "No company name"}
        period={statements.period.label}
        columns={["Debit", "Credit", "Net"]}
        rows={[...trialRows, { label: "Grand Total", debit: trialDebit, credit: trialCredit, net: trialDebit - trialCredit, total: true }]}
      />
    </PageShell>
  );
}

function StatementReport({ title, company, period, columns, rows }: { title: string; company: string; period: string; columns: string[]; rows: ReportRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm" id={title === "Balance Sheet" ? "accounts-receivable" : undefined}>
      <div className="border-b bg-background px-4 py-4 text-center">
        <h2 className="text-base font-semibold leading-tight">{company}</h2>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{period}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-right">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Account</th>
              {columns.map((column) => <th key={column} className="px-3 py-2 font-semibold text-muted-foreground">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`} className={row.section ? "bg-muted/45 font-semibold" : row.total ? "border-t bg-background font-semibold" : "hover:bg-secondary/35"}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2" style={{ paddingLeft: `${(row.level ?? 0) * 16}px` }}>
                    {row.section && <span className="text-muted-foreground">⌄</span>}
                    {row.href && !row.section ? <Link href={row.href} className="hover:text-primary hover:underline">{row.label}</Link> : row.label}
                  </span>
                </td>
                {columns.length === 1 ? (
                  <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.amount ?? 0)}</td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.debit ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.credit ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.net ?? 0)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatAmount(value: number) {
  if (value < 0) return `(${money(Math.abs(value)).replace("Rs. ", "")})`;
  return money(value).replace("Rs. ", "");
}
