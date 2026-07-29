import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { dateInput, money } from "@/lib/utils";
import { FiscalYear } from "@/models/FiscalYear";
import { Organization } from "@/models/Organization";
import { fiscalYearOptions, getFinancialStatements } from "@/services/financial-statements";
import { getDerivedLedger } from "@/services/accounts";

type ReportRow = {
  label: string;
  amount?: number;
  compareAmount?: number;
  debit?: number;
  credit?: number;
  net?: number;
  compareNet?: number;
  level?: number;
  section?: boolean;
  total?: boolean;
  href?: string;
};

type FiscalYearOption = {
  value: string;
  label: string;
  from: string;
  to: string;
  status?: string;
  source: "saved" | "generated";
};

export default async function AccountsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fyOptions = buildFiscalYearOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : fyOptions[0]?.value;
  const fy = resolveFiscalYearOption(fyOptions, selectedFY) ?? fyOptions[0];
  const selectedCompareFY = typeof params?.compareFy === "string" ? params.compareFy : fyOptions.find((option) => option.value !== fy.value)?.value ?? "none";
  const compareFY = selectedCompareFY === "none" ? undefined : resolveFiscalYearOption(fyOptions, selectedCompareFY);
  const customRange = selectedFY === "custom";
  const filters = {
    organizationId,
    from: customRange && typeof params?.from === "string" ? params.from : fy.from,
    to: customRange && typeof params?.to === "string" ? params.to : fy.to
  };
  const compareFilters = compareFY ? { organizationId, from: compareFY.from, to: compareFY.to } : undefined;
  const [statements, organization, ledger, compareStatements, compareLedger] = await Promise.all([
    getFinancialStatements(filters),
    Organization.findById(organizationId).select("name").lean() as any,
    getDerivedLedger(organizationId, filters.from, filters.to),
    compareFilters ? getFinancialStatements(compareFilters) : Promise.resolve(null),
    compareFilters ? getDerivedLedger(organizationId, compareFilters.from, compareFilters.to) : Promise.resolve(null)
  ]);
  const qs = new URLSearchParams({ from: filters.from, to: filters.to });
  const baseLedger = `/ledger?${qs}`;
  const expenseBase = `/expenses?from=${filters.from}&to=${filters.to}&approvalStatus=approved`;
  const compareQs = compareFilters ? new URLSearchParams({ from: compareFilters.from, to: compareFilters.to }) : undefined;
  const compareBaseLedger = compareQs ? `/ledger?${compareQs}` : baseLedger;
  const compareExpenseBase = compareFilters ? `/expenses?from=${compareFilters.from}&to=${compareFilters.to}&approvalStatus=approved` : expenseBase;
  const summary = statements.summary;
  const liabilitiesAndEquity = summary.totalLiabilities + summary.ownerEquity;
  const balanceDifference = summary.totalAssets - liabilitiesAndEquity;
  const balanceRows = withComparison([
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
  ], compareStatements ? [
    { label: "Assets", section: true },
    { label: "Current Assets", level: 1 },
    { label: "Cash / Bank Balance", amount: compareStatements.summary.cashAtBank, level: 2, href: `${compareBaseLedger}&accountCode=1000` },
    { label: "Accounts Receivable", amount: compareStatements.summary.accountsReceivable, level: 2, href: "#accounts-receivable" },
    ...compareStatements.receivables.map((row: any) => ({ label: `${row.projectName} (${row.projectCode})`, amount: row.due, level: 3, href: `/projects/${row.projectId}` })),
    { label: "Total Assets", amount: compareStatements.summary.totalAssets, total: true },
    { label: "Liabilities & Equity", section: true },
    { label: "Current Liabilities", level: 1 },
    { label: "Estimated Tax Provision", amount: compareStatements.summary.estimatedTaxPayable, level: 2, href: "/tax" },
    { label: "Accounts Payable", amount: 0, level: 2 },
    { label: "Total Liabilities", amount: compareStatements.summary.totalLiabilities, total: true },
    { label: "Equity", level: 1 },
    { label: "Owner/Other Funds To Date", amount: compareStatements.balanceSheet.equity[0]?.amount ?? 0, level: 2, href: "/general-funds" },
    { label: "Retained Earnings / Balancing Equity", amount: compareStatements.balanceSheet.equity[1]?.amount ?? 0, level: 2, href: `${compareBaseLedger}&accountCode=3000` },
    { label: "Total Equity", amount: compareStatements.summary.ownerEquity, total: true },
    { label: "Difference", amount: compareStatements.summary.totalAssets - (compareStatements.summary.totalLiabilities + compareStatements.summary.ownerEquity), total: true }
  ] : undefined);
  const profitRows = withComparison([
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
  ], compareStatements ? [
    { label: "Revenue", section: true },
    { label: "Client Project Revenue", amount: compareStatements.summary.revenue, level: 1, href: "/project-payments" },
    { label: "Total Revenue", amount: compareStatements.summary.revenue, total: true },
    { label: "Operating Expenses", section: true },
    { label: "Direct Client Project Expenses", amount: compareStatements.summary.clientProjectExpenses, level: 1, href: `${compareExpenseBase}&expenseType=project` },
    { label: "Internal Project Expenses", amount: compareStatements.summary.internalProjectExpenses, level: 1, href: `${compareExpenseBase}&expenseType=project` },
    { label: "General/Admin Expenses", amount: compareStatements.summary.generalExpenses, level: 1, href: `${compareExpenseBase}&expenseType=general` },
    { label: "Total Operating Expenses", amount: compareStatements.summary.totalExpenses, total: true },
    { label: "Gross Profit", amount: compareStatements.summary.grossProfit, total: true },
    { label: "Operating Profit", amount: compareStatements.summary.netProfitBeforeTax, total: true },
    { label: "Estimated Tax Provision", amount: -compareStatements.summary.estimatedTaxPayable, level: 1, href: "/tax" },
    { label: "Net Profit After Tax", amount: compareStatements.summary.netProfitAfterTax, total: true }
  ] : undefined);
  const trialRows: ReportRow[] = buildTrialRows(ledger.summary, compareLedger?.summary, baseLedger);
  const trialDebit = trialRows.reduce((sum, row) => sum + (row.debit ?? 0), 0);
  const trialCredit = trialRows.reduce((sum, row) => sum + (row.credit ?? 0), 0);
  const trialCompareNet = trialRows.reduce((sum, row) => sum + (row.compareNet ?? 0), 0);
  const profitLabel = summary.netProfitAfterTax >= 0 ? "Net Profit" : "Net Loss";
  const compareProfitLabel = compareStatements ? (compareStatements.summary.netProfitAfterTax >= 0 ? "Net Profit" : "Net Loss") : undefined;

  return (
    <PageShell title="Accounts" description="Audit-style financial statements with clickable drilldowns to supporting records.">
      <form className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          {fyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <select className="native-control" name="compareFy" defaultValue={selectedCompareFY}>
          <option value="none">No comparison</option>
          {fyOptions.map((option) => <option key={option.value} value={option.value}>Compare: {option.label}</option>)}
        </select>
        <input className="native-control" type="date" name="from" defaultValue={filters.from} />
        <input className="native-control" type="date" name="to" defaultValue={filters.to} />
        <Button variant="outline">Filter</Button>
        <Button asChild variant="secondary"><Link href={`/api/accounts/export?format=csv&${qs}`}><Download className="h-4 w-4" />CSV</Link></Button>
        <Button asChild variant="secondary"><Link href={`/api/accounts/export?format=pdf&${qs}`}><Download className="h-4 w-4" />PDF</Link></Button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <ProfitCard label={profitLabel} amount={summary.netProfitAfterTax} detail={statements.period.label} />
        <ProfitCard label="Profit Before Tax" amount={summary.netProfitBeforeTax} detail={`Tax provision ${money(summary.estimatedTaxPayable)}`} />
        {compareStatements ? (
          <ProfitCard label={compareProfitLabel ?? "Comparison"} amount={compareStatements.summary.netProfitAfterTax} detail={`${compareStatements.period.label} · change ${money(summary.netProfitAfterTax - compareStatements.summary.netProfitAfterTax)}`} />
        ) : (
          <ProfitCard label="Comparison" amount={0} detail="Select a fiscal year to compare." muted />
        )}
      </div>

      <StatementReport title="Balance Sheet" company={organization?.name ?? "No company name"} period={statements.period.label} comparisonPeriod={compareStatements?.period.label} columns={["Balance"]} rows={balanceRows} />
      <StatementReport title="Profit and Loss" company={organization?.name ?? "No company name"} period={statements.period.label} comparisonPeriod={compareStatements?.period.label} columns={["Amount"]} rows={profitRows} />
      <StatementReport
        title="Trial Balance"
        company={organization?.name ?? "No company name"}
        period={statements.period.label}
        comparisonPeriod={compareStatements?.period.label}
        columns={["Debit", "Credit", "Net"]}
        rows={[...trialRows, { label: "Grand Total", debit: trialDebit, credit: trialCredit, net: trialDebit - trialCredit, compareNet: trialCompareNet, total: true }]}
      />
    </PageShell>
  );
}

function buildFiscalYearOptions(savedYears: any[]): FiscalYearOption[] {
  const savedOptions = savedYears.map((year) => ({
    value: `saved:${year._id.toString()}`,
    label: `${year.name}${year.status ? ` (${year.status})` : ""}`,
    from: dateInput(year.startDate),
    to: dateInput(year.endDate),
    status: year.status,
    source: "saved" as const
  }));
  const seenRanges = new Set(savedOptions.map((option) => `${option.from}:${option.to}`));
  const generatedOptions = fiscalYearOptions()
    .filter((option) => !seenRanges.has(`${option.from}:${option.to}`))
    .map((option) => ({
      value: `generated:${option.label}`,
      label: option.label,
      from: option.from,
      to: option.to,
      source: "generated" as const
    }));
  return [...savedOptions, ...generatedOptions];
}

function resolveFiscalYearOption(options: FiscalYearOption[], value: string | undefined) {
  if (!value || value === "custom") return undefined;
  return options.find((option) => option.value === value || option.label === value);
}

function StatementReport({ title, company, period, comparisonPeriod, columns, rows }: { title: string; company: string; period: string; comparisonPeriod?: string; columns: string[]; rows: ReportRow[] }) {
  const hasComparison = Boolean(comparisonPeriod);
  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm" id={title === "Balance Sheet" ? "accounts-receivable" : undefined}>
      <div className="border-b bg-background px-4 py-4 text-center">
        <h2 className="text-base font-semibold leading-tight">{company}</h2>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{period}</p>
        {comparisonPeriod && <p className="text-xs text-muted-foreground">Compared with {comparisonPeriod}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-right">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Account</th>
              {columns.length === 1 && hasComparison ? (
                <>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Current</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Compare</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Change</th>
                </>
              ) : columns.length === 1 ? (
                columns.map((column) => <th key={column} className="px-3 py-2 font-semibold text-muted-foreground">{column}</th>)
              ) : hasComparison ? (
                <>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Debit</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Credit</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Net</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Compare Net</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Change</th>
                </>
              ) : (
                columns.map((column) => <th key={column} className="px-3 py-2 font-semibold text-muted-foreground">{column}</th>)
              )}
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
                {columns.length === 1 && hasComparison ? (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">{row.section ? "" : formatAmount(row.amount ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.section ? "" : formatAmount(row.compareAmount ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.section ? "" : formatAmount((row.amount ?? 0) - (row.compareAmount ?? 0))}</td>
                  </>
                ) : columns.length === 1 ? (
                  <td className="px-3 py-2 text-right tabular-nums">{row.section ? "" : formatAmount(row.amount ?? 0)}</td>
                ) : hasComparison ? (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.debit ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.credit ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.net ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(row.compareNet ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount((row.net ?? 0) - (row.compareNet ?? 0))}</td>
                  </>
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

function ProfitCard({ label, amount, detail, muted = false }: { label: string; amount: number; detail: string; muted?: boolean }) {
  const positive = amount >= 0;
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${muted ? "text-muted-foreground" : positive ? "text-primary" : "text-destructive"}`}>{muted ? "-" : money(Math.abs(amount))}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function withComparison(rows: ReportRow[], compareRows?: ReportRow[]) {
  if (!compareRows) return rows;
  const compareMap = new Map(compareRows.map((row) => [row.label, row.amount ?? 0]));
  return rows.map((row) => ({ ...row, compareAmount: compareMap.get(row.label) ?? 0 }));
}

function buildTrialRows(currentRows: any[], compareRows: any[] | undefined, baseLedger: string): ReportRow[] {
  const currentMap = new Map(currentRows.map((row: any) => [row.accountCode, row]));
  const compareMap = new Map((compareRows ?? []).map((row: any) => [row.accountCode, row]));
  const codes = Array.from(new Set([...currentMap.keys(), ...compareMap.keys()])).sort();
  return codes.map((code) => {
    const current = currentMap.get(code) as any;
    const compare = compareMap.get(code) as any;
    return {
      label: `${code} - ${current?.accountName ?? compare?.accountName ?? "Account"}`,
      debit: current?.debit ?? 0,
      credit: current?.credit ?? 0,
      net: current?.balance ?? 0,
      compareNet: compare?.balance ?? 0,
      href: `${baseLedger}&accountCode=${code}`
    };
  });
}

function formatAmount(value: number) {
  if (value < 0) return `(${money(Math.abs(value)).replace("Rs. ", "")})`;
  return money(value).replace("Rs. ", "");
}
