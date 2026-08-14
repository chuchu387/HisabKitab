import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { PurchaseOrderForm } from "@/features/forms/purchase-order-form";
import { convertPurchaseOrderToApInvoice, deletePurchaseOrder } from "@/actions/purchase-orders";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { ApInvoice } from "@/models/ApInvoice";
import { Project } from "@/models/Project";
import { PurchaseOrder } from "@/models/PurchaseOrder";

void Project;
void ApInvoice;

export default async function PurchaseOrdersPage({ searchParams }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const params = await searchParams;
  const [projects, orders] = await Promise.all([
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    PurchaseOrder.find({ organizationId }).populate("projectId convertedApInvoiceId").sort({ orderDate: -1 }).lean()
  ]);
  const totals = orders.reduce((acc: any, order: any) => {
    acc.total += order.total ?? 0;
    acc.vat += order.vatAmount ?? 0;
    if (order.status !== "converted" && order.status !== "cancelled") acc.open += order.total ?? 0;
    return acc;
  }, { total: 0, vat: 0, open: 0 });

  return (
    <PageShell title="Purchase Orders" description="Create vendor purchase orders and convert received bills into AP invoices.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Purchase Order Total" value={totals.total} currency />
        <StatCard label="Open PO Value" value={totals.open} currency />
        <StatCard label="Input VAT Planned" value={totals.vat} currency />
        <StatCard label="Orders" value={orders.length} />
      </div>
      <PurchaseOrderForm projects={JSON.parse(JSON.stringify(projects))} />
      <DataTable data={orders} pagination={{ basePath: "/purchase-orders", searchParams: params }} columns={[
        { header: "PO No.", cell: (order: any) => <span className="font-medium">{order.orderNumber}</span> },
        { header: "Vendor", cell: (order: any) => order.vendorName },
        { header: "Project", cell: (order: any) => order.projectId?.name ?? "-" },
        { header: "Date", cell: (order: any) => formatDate(order.orderDate) },
        { header: "Expected Bill", cell: (order: any) => order.expectedBillDate ? formatDate(order.expectedBillDate) : "-" },
        { header: "Status", cell: (order: any) => <Badge variant={order.status === "converted" ? "success" : order.status === "cancelled" ? "danger" : "warning"}>{order.status}</Badge> },
        { header: "VAT", cell: (order: any) => order.taxable ? money(order.vatAmount ?? 0) : "No VAT" },
        { header: "Total", cell: (order: any) => money(order.total ?? 0) },
        { header: "AP Invoice", cell: (order: any) => order.convertedApInvoiceId ? <Link className="font-medium text-primary hover:underline" href="/ap-invoices">{order.convertedApInvoiceId.billNumber ?? "View"}</Link> : "-" },
        { header: "Actions", cell: (order: any) => (
          <div className="flex flex-wrap gap-2">
            {!order.convertedApInvoiceId && order.status !== "cancelled" && <form action={convertPurchaseOrderToApInvoice}><input type="hidden" name="id" value={order._id.toString()} /><Button size="sm" variant="outline">Create AP Invoice</Button></form>}
            {!order.convertedApInvoiceId && <form action={deletePurchaseOrder}><input type="hidden" name="id" value={order._id.toString()} /><ConfirmButton /></form>}
          </div>
        ) }
      ]} />
    </PageShell>
  );
}
