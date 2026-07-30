import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { InvoicePaymentForm } from "@/features/forms/invoice-payment-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, isObjectId, money } from "@/lib/utils";
import { Client } from "@/models/Client";
import { BankAccount } from "@/models/BankAccount";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { paymentBreakdown } from "@/services/project-payment-accounting";

void Client;
void Project;

export default async function InvoiceDetailPage({ params, searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const routeParams = await params;
  const queryParams = await searchParams;
  if (!isObjectId(routeParams.id)) notFound();
  const invoice = await Invoice.findOne({ _id: routeParams.id, organizationId }).populate("clientId projectId").lean() as any;
  if (!invoice) notFound();
  const [payments, bankAccounts] = await Promise.all([
    ProjectPayment.find({ organizationId, invoiceId: invoice._id }).populate("projectId createdBy bankAccountId invoiceId").sort({ paymentDate: -1 }).lean(),
    BankAccount.find({ organizationId, active: true }).sort({ name: 1 }).lean()
  ]);
  const paymentRows = (payments as any[]).map((payment) => ({ ...payment, accounting: paymentBreakdown(payment) }));
  const paidCash = paymentRows.reduce((sum, payment) => sum + payment.accounting.cashAmount, 0);
  const paidService = paymentRows.reduce((sum, payment) => sum + payment.accounting.serviceAmount, 0);
  const vatCollected = paymentRows.reduce((sum, payment) => sum + payment.accounting.vatPortion, 0);
  const dueCash = Math.max((invoice.total ?? 0) - paidCash, 0);
  const dueService = Math.max((invoice.subtotal ?? 0) - paidService, 0);
  return (
    <PageShell
      title={invoice.invoiceNumber}
      description={`${invoice.clientId?.name ?? "Client"} · ${invoice.projectId?.name ?? "No project"}`}
      breadcrumb={[{ label: "Invoices", href: "/invoices" }, { label: invoice.invoiceNumber }]}
      action={<div className="flex gap-2"><Button asChild variant="outline"><Link href={`/invoices/${invoice._id}/edit`}>Edit</Link></Button><Button asChild><Link href={`/api/invoices/${invoice._id}/pdf`}><Download className="h-4 w-4" />PDF</Link></Button></div>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subtotal / Service" value={invoice.subtotal ?? 0} currency />
        <StatCard label="VAT" value={invoice.vatAmount ?? 0} currency />
        <StatCard label="Invoice Total" value={invoice.total ?? 0} currency />
        <StatCard label="Cash Due" value={dueCash} currency />
        <StatCard label="Paid Cash" value={paidCash || invoice.paidAmount || 0} currency />
        <StatCard label="Paid Service" value={paidService || Math.min(invoice.paidAmount ?? 0, invoice.subtotal ?? 0)} currency />
        <StatCard label="VAT Collected" value={vatCollected} currency />
        <StatCard label="Service Due" value={dueService} currency />
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <Info label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
          <Info label="Due Date" value={formatDate(invoice.dueDate)} />
          <Info label="Status" value={invoice.status} />
          <Info label="VAT Treatment" value={invoice.vatApplicable ? `${invoice.vatRate}% VAT` : "No VAT"} />
          <Info label="Notes" value={invoice.notes || "-"} />
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Record Payment</h2>
        <InvoicePaymentForm invoice={JSON.parse(JSON.stringify(invoice))} bankAccounts={JSON.parse(JSON.stringify(bankAccounts))} dueAmount={dueCash} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payment Allocation</h2>
        <DataTable data={paymentRows} pagination={{ basePath: `/invoices/${invoice._id}`, searchParams: queryParams }} columns={[
          { header: "Date", cell: (payment: any) => formatDate(payment.paymentDate) },
          { header: "Voucher", cell: (payment: any) => payment.voucherNumber || "-" },
          { header: "Cash", cell: (payment: any) => money(payment.accounting.cashAmount) },
          { header: "Service", cell: (payment: any) => money(payment.accounting.serviceAmount) },
          { header: "VAT", cell: (payment: any) => payment.accounting.vatPortion ? money(payment.accounting.vatPortion) : "-" },
          { header: "Account", cell: (payment: any) => payment.bankAccountId?.name ?? "Default" },
          { header: "Added By", cell: (payment: any) => payment.createdBy?.name ?? "Unknown" }
        ]} />
      </section>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
