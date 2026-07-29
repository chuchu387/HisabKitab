import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { InvoiceForm } from "@/features/forms/invoice-form";
import { deleteInvoice } from "@/actions/invoices";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";

void Client;
void Project;

export default async function InvoicesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const [clients, projects, invoices] = await Promise.all([
    Client.find({ organizationId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    Invoice.find({ organizationId }).populate("clientId projectId").sort({ invoiceDate: -1 }).lean()
  ]);
  const invoiceClients = clients.map((client: any) => ({
    _id: client._id.toString(),
    name: client.name,
    code: client.code,
    active: client.active !== false
  }));
  const invoiceProjects = projects.map((project: any) => ({
    _id: project._id.toString(),
    name: project.name,
    code: project.code,
    projectType: project.projectType ?? "client",
    clientId: project.clientId?.toString?.() ?? ""
  }));
  const totals = invoices.reduce((acc: any, invoice: any) => {
    acc.total += invoice.total ?? 0;
    acc.paid += invoice.paidAmount ?? 0;
    acc.due += Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0);
    return acc;
  }, { total: 0, paid: 0, due: 0 });
  return (
    <PageShell title="Invoices" description="Create and track client invoices. Email sending is intentionally disabled for invoices.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoice Total" value={totals.total} currency />
        <StatCard label="Paid" value={totals.paid} currency />
        <StatCard label="Due" value={totals.due} currency />
        <StatCard label="Invoices" value={invoices.length} />
      </div>
      <InvoiceForm clients={invoiceClients} projects={invoiceProjects} />
      <DataTable data={invoices} pagination={{ basePath: "/invoices", searchParams: params }} columns={[
        { header: "Invoice", cell: (invoice: any) => invoice.invoiceNumber },
        { header: "Client", cell: (invoice: any) => invoice.clientId?.name ?? "-" },
        { header: "Project", cell: (invoice: any) => invoice.projectId?.name ?? "-" },
        { header: "Date", cell: (invoice: any) => formatDate(invoice.invoiceDate) },
        { header: "Due Date", cell: (invoice: any) => formatDate(invoice.dueDate) },
        { header: "Status", cell: (invoice: any) => <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "void" ? "danger" : "warning"}>{invoice.status}</Badge> },
        { header: "Total", cell: (invoice: any) => money(invoice.total ?? 0) },
        { header: "Balance", cell: (invoice: any) => money(Math.max((invoice.total ?? 0) - (invoice.paidAmount ?? 0), 0)) },
        { header: "Actions", cell: (invoice: any) => <div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link href={`/api/invoices/${invoice._id}/pdf`}><Download className="h-4 w-4" />PDF</Link></Button><form action={deleteInvoice}><input type="hidden" name="id" value={invoice._id.toString()} /><ConfirmButton /></form></div> }
      ]} />
    </PageShell>
  );
}
