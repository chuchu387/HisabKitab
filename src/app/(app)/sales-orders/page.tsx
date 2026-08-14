import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { SalesOrderForm } from "@/features/forms/sales-order-form";
import { convertSalesOrderToInvoice, deleteSalesOrder } from "@/actions/sales-orders";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { SalesOrder } from "@/models/SalesOrder";

void Client;
void Project;
void Invoice;

export default async function SalesOrdersPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const [clients, projects, orders, organization] = await Promise.all([
    Client.find({ organizationId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    SalesOrder.find({ organizationId }).populate("clientId projectId convertedInvoiceId").sort({ orderDate: -1 }).lean(),
    Organization.findById(organizationId).select("vatRegistered defaultVatRate panNumber vatEffectiveDate").lean()
  ]);
  const totals = orders.reduce((acc: any, order: any) => {
    acc.total += order.total ?? 0;
    acc.vat += order.vatAmount ?? 0;
    if (order.status !== "converted" && order.status !== "cancelled") acc.open += order.total ?? 0;
    return acc;
  }, { total: 0, vat: 0, open: 0 });

  return (
    <PageShell title="Sales Orders" description="Create client sales orders and convert accepted orders into AR invoices.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales Order Total" value={totals.total} currency />
        <StatCard label="Open Order Value" value={totals.open} currency />
        <StatCard label="Output VAT Planned" value={totals.vat} currency />
        <StatCard label="Orders" value={orders.length} />
      </div>
      <SalesOrderForm
        clients={JSON.parse(JSON.stringify(clients))}
        projects={JSON.parse(JSON.stringify(projects))}
        organization={JSON.parse(JSON.stringify(organization))}
      />
      <DataTable data={orders} pagination={{ basePath: "/sales-orders", searchParams: params }} columns={[
        { header: "SO No.", cell: (order: any) => <span className="font-medium">{order.orderNumber}</span> },
        { header: "Client", cell: (order: any) => order.clientId?.name ?? "-" },
        { header: "Project", cell: (order: any) => order.projectId?.name ?? "-" },
        { header: "Date", cell: (order: any) => formatDate(order.orderDate) },
        { header: "Expected Invoice", cell: (order: any) => order.expectedInvoiceDate ? formatDate(order.expectedInvoiceDate) : "-" },
        { header: "Status", cell: (order: any) => <Badge variant={order.status === "converted" ? "success" : order.status === "cancelled" ? "danger" : "warning"}>{order.status}</Badge> },
        { header: "VAT", cell: (order: any) => order.vatApplicable ? money(order.vatAmount ?? 0) : "No VAT" },
        { header: "Total", cell: (order: any) => money(order.total ?? 0) },
        { header: "Invoice", cell: (order: any) => order.convertedInvoiceId ? <Link className="font-medium text-primary hover:underline" href={`/invoices/${order.convertedInvoiceId._id ?? order.convertedInvoiceId}`}>{order.convertedInvoiceId.invoiceNumber ?? "View"}</Link> : "-" },
        { header: "Actions", cell: (order: any) => (
          <div className="flex flex-wrap gap-2">
            {!order.convertedInvoiceId && order.status !== "cancelled" && <form action={convertSalesOrderToInvoice}><input type="hidden" name="id" value={order._id.toString()} /><Button size="sm" variant="outline">Create AR Invoice</Button></form>}
            {!order.convertedInvoiceId && <form action={deleteSalesOrder}><input type="hidden" name="id" value={order._id.toString()} /><ConfirmButton /></form>}
          </div>
        ) }
      ]} />
    </PageShell>
  );
}
