import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { StatCard } from "@/components/stat-card";
import { FilterForm } from "@/components/filter-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter } from "@/services/fiscal-year-filter";

export default async function ProfitabilityPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const from = fyRange.from;
  const to = fyRange.to ? (() => { const end = new Date(fyRange.to); end.setHours(23, 59, 59, 999); return end; })() : null;
  const projectQuery: any = { organizationId };
  if (q) projectQuery.name = new RegExp(q, "i");

  const [projects, invoices, expenses, payments] = await Promise.all([
    Project.find(projectQuery).sort({ name: 1 }).lean(),
    Invoice.aggregate([
      { $match: { organizationId, projectId: { $ne: null }, status: { $ne: "void" }, ...(from || to ? { invoiceDate: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}) } },
      { $group: { _id: "$projectId", invoiced: { $sum: "$total" }, count: { $sum: 1 } } }
    ]),
    Expense.aggregate([
      { $match: { organizationId, projectId: { $ne: null }, ...(from || to ? { expenseDate: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}) } },
      { $group: { _id: "$projectId", spent: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]),
    ProjectPayment.aggregate([
      { $match: { organizationId, ...(from || to ? { paymentDate: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}) } },
      { $group: { _id: "$projectId", collected: { $sum: "$amount" }, count: { $sum: 1 } } }
    ])
  ]);

  const byId = (rows: any[]) => new Map(rows.map((row) => [row._id.toString(), row]));
  const invoiceMap = byId(invoices);
  const expenseMap = byId(expenses);
  const paymentMap = byId(payments);

  const rows = projects.map((project: any) => {
    const id = project._id.toString();
    const invoiced = invoiceMap.get(id)?.invoiced ?? 0;
    const collected = paymentMap.get(id)?.collected ?? 0;
    const spent = expenseMap.get(id)?.spent ?? 0;
    const profit = invoiced - spent;
    const margin = invoiced > 0 ? (profit / invoiced) * 100 : 0;
    return {
      _id: id,
      name: project.name,
      code: project.code,
      projectType: project.projectType,
      status: project.status,
      invoiced,
      collected,
      spent,
      profit,
      margin,
      invoiceCount: invoiceMap.get(id)?.count ?? 0,
      expenseCount: expenseMap.get(id)?.count ?? 0,
      paymentCount: paymentMap.get(id)?.count ?? 0
    };
  });
  rows.sort((a: any, b: any) => b.profit - a.profit);

  const totals = rows.reduce(
    (acc, row) => ({
      invoiced: acc.invoiced + row.invoiced,
      collected: acc.collected + row.collected,
      spent: acc.spent + row.spent,
      profit: acc.profit + row.profit
    }),
    { invoiced: 0, collected: 0, spent: 0, profit: 0 }
  );

  const exportParams = new URLSearchParams();
  if (selectedFY !== "all") exportParams.set("fy", selectedFY);
  if (params?.from) exportParams.set("from", params.from);
  if (params?.to) exportParams.set("to", params.to);
  if (q) exportParams.set("q", q);
  const exportHref = `/api/reports/profitability/export?${exportParams.toString()}`;

  return (
    <PageShell
      title="Project Profitability"
      action={<Button asChild><a href={exportHref}><Download className="h-4 w-4" />Export CSV</a></Button>}
    >
      <FilterForm className="filter-bar">
        <SearchBar placeholder="Search projects" defaultValue={q} />
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
        <StatCard label="Invoiced Revenue" value={totals.invoiced} currency />
        <StatCard label="Collected" value={totals.collected} currency />
        <StatCard label="Project Expenses" value={totals.spent} currency />
        <StatCard label="Gross Profit" value={totals.profit} currency />
      </div>
      {rows.length ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 text-right font-semibold">Invoiced</th>
                  <th className="px-4 py-3 text-right font-semibold">Collected</th>
                  <th className="px-4 py-3 text-right font-semibold">Expenses</th>
                  <th className="px-4 py-3 text-right font-semibold">Profit</th>
                  <th className="px-4 py-3 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => (
                  <tr key={row._id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${row._id}`} className="font-medium hover:text-primary">{row.name}</Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.code}</span>
                        <Badge variant={row.projectType === "internal" ? "default" : "info"}>{row.projectType}</Badge>
                        <span>{row.invoiceCount} invoices · {row.expenseCount} expenses · {row.paymentCount} payments</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{money(row.invoiced)}</td>
                    <td className="px-4 py-3 text-right">{money(row.collected)}</td>
                    <td className="px-4 py-3 text-right">{money(row.spent)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.profit < 0 ? "text-destructive" : ""}`}>{money(row.profit)}</td>
                    <td className="px-4 py-3 text-right font-medium">{row.margin.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No projects found.</p>
      )}
    </PageShell>
  );
}
