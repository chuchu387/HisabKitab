import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ApInvoiceForm } from "@/features/forms/ap-invoice-form";
import { deleteApInvoice } from "@/actions/ap-invoices";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { ApInvoice } from "@/models/ApInvoice";
import { Project } from "@/models/Project";
import { PurchaseOrder } from "@/models/PurchaseOrder";

void Project;
void PurchaseOrder;

export default async function ApInvoicesPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const [projects, purchaseOrders, invoices] = await Promise.all([
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    PurchaseOrder.find({ organizationId, convertedApInvoiceId: null, status: { $ne: "cancelled" } }).sort({ orderDate: -1 }).lean(),
    ApInvoice.find({ organizationId }).populate("projectId purchaseOrderId").sort({ invoiceDate: -1 }).lean()
  ]);
  const totals = invoices.reduce((acc: any, invoice: any) => {
    acc.total += invoice.total ?? 0;
    acc.paid += invoice.paidAmount ?? 0;
    acc.vat += invoice.vatAmount ?? 0;
    acc.due += Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0);
    return acc;
  }, { total: 0, paid: 0, vat: 0, due: 0 });

  return (
    <PageShell title="AP Invoices" description="Record supplier bills and track accounts payable balances.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="AP Invoice Total" value={totals.total} currency />
        <StatCard label="Paid" value={totals.paid} currency />
        <StatCard label="Input VAT" value={totals.vat} currency />
        <StatCard label="Payable Due" value={totals.due} currency />
      </div>
      <ApInvoiceForm projects={JSON.parse(JSON.stringify(projects))} purchaseOrders={JSON.parse(JSON.stringify(purchaseOrders))} />
      <DataTable data={invoices} pagination={{ basePath: "/ap-invoices", searchParams: params }} columns={[
        { header: "Bill No.", cell: (invoice: any) => <span className="font-medium">{invoice.billNumber}</span> },
        { header: "Vendor", cell: (invoice: any) => invoice.vendorName },
        { header: "Project", cell: (invoice: any) => invoice.projectId?.name ?? "-" },
        { header: "PO", cell: (invoice: any) => invoice.purchaseOrderId?.orderNumber ?? "-" },
        { header: "Invoice Date", cell: (invoice: any) => formatDate(invoice.invoiceDate) },
        { header: "Due Date", cell: (invoice: any) => formatDate(invoice.dueDate) },
        { header: "Status", cell: (invoice: any) => <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "void" ? "danger" : "warning"}>{invoice.status}</Badge> },
        { header: "VAT", cell: (invoice: any) => invoice.taxable ? money(invoice.vatAmount ?? 0) : "No VAT" },
        { header: "Total", cell: (invoice: any) => money(invoice.total ?? 0) },
        { header: "Balance", cell: (invoice: any) => money(Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0)) },
        { header: "Actions", cell: (invoice: any) => <form action={deleteApInvoice}><input type="hidden" name="id" value={invoice._id.toString()} /><ConfirmButton /></form> }
      ]} />
    </PageShell>
  );
}
