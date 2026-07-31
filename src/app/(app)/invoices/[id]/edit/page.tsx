import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { InvoiceForm } from "@/features/forms/invoice-form";
import { updateInvoice } from "@/actions/invoices";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";

export default async function EditInvoicePage({ params }: any) {
  const { organizationId } = await requireFeature("accountingView");
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const [invoice, clients, projects, organization] = await Promise.all([
    Invoice.findOne({ _id: routeParams.id, organizationId }).lean(),
    Client.find({ organizationId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    Organization.findById(organizationId).select("vatRegistered defaultVatRate vatEffectiveDate panNumber").lean()
  ]);
  if (!invoice) notFound();
  const action = updateInvoice.bind(null, routeParams.id);
  return (
    <PageShell title="Edit Invoice" breadcrumb={[{ label: "Invoices", href: "/invoices" }, { label: String((invoice as any).invoiceNumber), href: `/invoices/${routeParams.id}` }, { label: "Edit" }]}>
      <InvoiceForm
        clients={JSON.parse(JSON.stringify(clients))}
        projects={JSON.parse(JSON.stringify(projects))}
        organization={JSON.parse(JSON.stringify(organization))}
        invoice={JSON.parse(JSON.stringify(invoice))}
        action={action}
      />
    </PageShell>
  );
}
