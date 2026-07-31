import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ProjectPaymentForm } from "@/features/forms/project-payment-form";
import { updateProjectPayment } from "@/actions/project-payments";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { BankAccount } from "@/models/BankAccount";
import { Client } from "@/models/Client";
import { Invoice } from "@/models/Invoice";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";

void Client;

export default async function EditProjectPaymentPage({ params }: any) {
  const { organizationId } = await requireFeature("paymentsView");
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const [payment, projects, invoices, bankAccounts] = await Promise.all([
    ProjectPayment.findOne({ _id: routeParams.id, organizationId }).lean(),
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    Invoice.find({ organizationId, status: { $ne: "void" } }).populate("clientId").sort({ invoiceDate: -1 }).lean(),
    BankAccount.find({ organizationId, active: true }).sort({ name: 1 }).lean()
  ]);
  if (!payment) notFound();
  const action = updateProjectPayment.bind(null, routeParams.id);
  return (
    <PageShell title="Edit Project Payment" breadcrumb={[{ label: "Payments", href: "/project-payments" }, { label: "Edit" }]}>
      <ProjectPaymentForm
        projects={JSON.parse(JSON.stringify(projects))}
        invoices={JSON.parse(JSON.stringify(invoices))}
        bankAccounts={JSON.parse(JSON.stringify(bankAccounts))}
        payment={JSON.parse(JSON.stringify(payment))}
        action={action}
      />
    </PageShell>
  );
}
