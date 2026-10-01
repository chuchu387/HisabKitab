import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { dateInput, formatDate, money } from "@/lib/utils";
import { ApInvoice } from "@/models/ApInvoice";
import { Expense } from "@/models/Expense";
import { FiscalYear } from "@/models/FiscalYear";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { SalesOrder } from "@/models/SalesOrder";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

type VatRow = {
  id: string;
  direction: "output" | "input";
  source: string;
  date: Date;
  party: string;
  company: string;
  reference: string;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: string;
  href: string;
};

export default async function VatRegisterPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : (fiscalYearOptions[0]?.value ?? "all");
  const selectedType = typeof params?.type === "string" ? params.type : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const from = fyRange.from ? dateInput(fyRange.from) : undefined;
  const to = fyRange.to ? dateInput(fyRange.to) : undefined;
  const range: any = {};
  if (fyRange.from) range.$gte = fyRange.from;
  if (fyRange.to) {
    const end = new Date(fyRange.to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  const organization = await Organization.findById(organizationId).select("name panNumber vatRegistered defaultVatRate vatEffectiveDate").lean() as any;
  const dateRangeEnabled = Object.keys(range).length > 0;
  const invoiceMatch: any = { organizationId, status: { $ne: "void" }, vatAmount: { $gt: 0 } };
  const salesOrderMatch: any = { organizationId, status: { $ne: "cancelled" }, vatAmount: { $gt: 0 } };
  const apInvoiceMatch: any = { organizationId, status: { $ne: "void" }, vatAmount: { $gt: 0 } };
  const expenseMatch: any = { organizationId, approvalStatus: "approved", vatAmount: { $gt: 0 } };
  if (dateRangeEnabled) {
    invoiceMatch.invoiceDate = range;
    salesOrderMatch.orderDate = range;
    apInvoiceMatch.invoiceDate = range;
    expenseMatch.expenseDate = range;
  }

  const [invoices, salesOrders, apInvoices, expenses] = await Promise.all([
    Invoice.find(invoiceMatch).populate("clientId projectId").sort({ invoiceDate: -1 }).lean(),
    SalesOrder.find(salesOrderMatch).populate("clientId projectId convertedInvoiceId").sort({ orderDate: -1 }).lean(),
    ApInvoice.find(apInvoiceMatch).populate("projectId purchaseOrderId").sort({ invoiceDate: -1 }).lean(),
    Expense.find(expenseMatch).populate("projectId categoryId").sort({ expenseDate: -1 }).lean()
  ]);

  const outputRows: VatRow[] = [
    ...invoices.map((invoice: any) => ({
      id: invoice._id.toString(),
      direction: "output" as const,
      source: "AR Invoice",
      date: invoice.invoiceDate,
      party: invoice.clientId?.name ?? "-",
      company: invoice.projectId?.name ?? organization?.name ?? "Company",
      reference: invoice.invoiceNumber,
      taxableAmount: invoice.subtotal ?? 0,
      vatRate: invoice.vatRate ?? 0,
      vatAmount: invoice.vatAmount ?? 0,
      total: invoice.total ?? 0,
      status: invoice.status,
      href: `/invoices/${invoice._id.toString()}`
    })),
    ...salesOrders.map((order: any) => ({
      id: order._id.toString(),
      direction: "output" as const,
      source: "Sales Order",
      date: order.orderDate,
      party: order.clientId?.name ?? "-",
      company: order.projectId?.name ?? organization?.name ?? "Company",
      reference: order.orderNumber,
      taxableAmount: order.subtotal ?? 0,
      vatRate: order.vatRate ?? 0,
      vatAmount: order.vatAmount ?? 0,
      total: order.total ?? 0,
      status: order.convertedInvoiceId ? "converted" : order.status,
      href: "/sales-orders"
    }))
  ];

  const inputRows: VatRow[] = [
    ...apInvoices.map((invoice: any) => ({
      id: invoice._id.toString(),
      direction: "input" as const,
      source: "AP Invoice",
      date: invoice.invoiceDate,
      party: invoice.vendorName ?? "-",
      company: invoice.projectId?.name ?? organization?.name ?? "Company",
      reference: invoice.billNumber,
      taxableAmount: invoice.subtotal ?? 0,
      vatRate: invoice.vatRate ?? 0,
      vatAmount: invoice.vatAmount ?? 0,
      total: invoice.total ?? 0,
      status: invoice.status,
      href: "/ap-invoices"
    })),
    ...expenses.map((expense: any) => ({
      id: expense._id.toString(),
      direction: "input" as const,
      source: "Expense",
      date: expense.expenseDate,
      party: expense.vendorName || expense.categoryId?.name || "-",
      company: expense.projectId?.name ?? organization?.name ?? "Company",
      reference: expense.billNumber || expense.voucherNumber || "-",
      taxableAmount: Math.max((expense.amount ?? 0) - (expense.vatAmount ?? 0), 0),
      vatRate: 0,
      vatAmount: expense.vatAmount ?? 0,
      total: expense.amount ?? 0,
      status: expense.approvalStatus,
      href: `/expenses/${expense._id.toString()}`
    }))
  ];

  const rows = [...outputRows, ...inputRows]
    .filter((row) => selectedType === "all" || row.direction === selectedType)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const outputVat = outputRows.reduce((sum, row) => sum + row.vatAmount, 0);
  const inputVat = inputRows.reduce((sum, row) => sum + row.vatAmount, 0);
  const netVat = outputVat - inputVat;
  const outputTaxable = outputRows.reduce((sum, row) => sum + row.taxableAmount, 0);
  const inputTaxable = inputRows.reduce((sum, row) => sum + row.taxableAmount, 0);
  const periodLabel = selectedFY === "all" ? "All fiscal years" : (fyRange.selected?.label ?? "Selected period");

  return (
    <PageShell title="VAT Register" description="Collected VAT, input VAT, output VAT, and party-wise VAT details for audit and filing.">
      <FilterForm className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="all">All fiscal years</option>
          <option value="custom">Custom date range</option>
        </select>
        <select className="native-control" name="type" defaultValue={selectedType}>
          <option value="all">All VAT</option>
          <option value="output">Output VAT</option>
          <option value="input">Input VAT</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={from} />
        <input className="native-control" type="date" name="to" defaultValue={to} />
        <Button variant="outline">Filter</Button>
      </FilterForm>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="grid gap-2 p-4 text-sm md:grid-cols-3">
          <Info label="Showing" value={periodLabel} />
          <Info label="Organization" value={organization?.name ?? "Organization"} />
          <Info label="PAN/VAT" value={organization?.panNumber || "-"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Output VAT" value={outputVat} currency />
        <StatCard label="Input VAT" value={inputVat} currency />
        <StatCard label={netVat >= 0 ? "VAT Payable" : "VAT Credit"} value={Math.abs(netVat)} currency />
        <StatCard label="Sales Taxable Base" value={outputTaxable} currency />
        <StatCard label="Purchase Taxable Base" value={inputTaxable} currency />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <VatPanel title="Output VAT" description="VAT collected or planned from client sales and AR invoices." amount={outputVat} rows={outputRows} direction="output" />
        <VatPanel title="Input VAT" description="VAT paid on supplier bills and approved VAT expenses." amount={inputVat} rows={inputRows} direction="input" />
      </div>

      <DataTable data={rows} pagination={{ basePath: "/vat", searchParams: params }} columns={[
        { header: "Date", cell: (row) => formatDate(row.date) },
        { header: "FY", cell: (row) => fiscalYearLabelForDate(row.date) },
        { header: "Type", cell: (row) => <VatBadge direction={row.direction} /> },
        { header: "Source", cell: (row) => row.source },
        { header: "Party", cell: (row) => row.party },
        { header: "Company/Project", cell: (row) => row.company },
        { header: "Reference", cell: (row) => <Link className="font-medium text-primary hover:underline" href={row.href}>{row.reference}</Link> },
        { header: "Taxable", cell: (row) => money(row.taxableAmount), className: "text-right" },
        { header: "VAT %", cell: (row) => row.vatRate ? `${row.vatRate}%` : "-", className: "text-right" },
        { header: "VAT Amount", cell: (row) => money(row.vatAmount), className: "text-right" },
        { header: "Total", cell: (row) => money(row.total), className: "text-right" },
        { header: "Status", cell: (row) => <Badge variant={row.status === "paid" || row.status === "posted" || row.status === "converted" ? "success" : "warning"}>{row.status}</Badge> }
      ]} />
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function VatBadge({ direction }: { direction: "output" | "input" }) {
  return direction === "output" ? (
    <Badge variant="success"><ArrowUpRight className="mr-1 h-3 w-3" /> Output</Badge>
  ) : (
    <Badge variant="info"><ArrowDownLeft className="mr-1 h-3 w-3" /> Input</Badge>
  );
}

function VatPanel({
  title,
  description,
  amount,
  rows,
  direction
}: {
  title: string;
  description: string;
  amount: number;
  rows: VatRow[];
  direction: "output" | "input";
}) {
  const topRows = rows
    .slice()
    .sort((a, b) => b.vatAmount - a.vatAmount)
    .slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <VatBadge direction={direction} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <p className="text-2xl font-semibold">{money(amount)}</p>
        <div className="space-y-2">
          {topRows.length ? topRows.map((row) => (
            <div key={`${direction}-${row.source}-${row.id}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.party}</p>
                <p className="text-xs text-muted-foreground">{formatDate(row.date)} · {row.reference}</p>
              </div>
              <p className="font-semibold">{money(row.vatAmount)}</p>
            </div>
          )) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No VAT records for this period.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
