import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ProjectPaymentForm } from "@/features/forms/project-payment-form";
import { deleteProjectPayment } from "@/actions/project-payments";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { User } from "@/models/User";
import { Invoice } from "@/models/Invoice";
import { BankAccount } from "@/models/BankAccount";
import { FiscalYear } from "@/models/FiscalYear";
import { buildFiscalYearFilterOptions, dateRangeForFiscalYearFilter, fiscalYearLabelForDate } from "@/services/fiscal-year-filter";

void Project;
void User;

export default async function ProjectPaymentsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const savedFiscalYears = await FiscalYear.find({ organizationId }).sort({ startDate: -1 }).select("name startDate endDate status").lean();
  const fiscalYearOptions = buildFiscalYearFilterOptions(savedFiscalYears as any[]);
  const selectedFY = typeof params?.fy === "string" ? params.fy : "all";
  const fyRange = dateRangeForFiscalYearFilter(fiscalYearOptions, selectedFY, params?.from, params?.to);
  const paymentQuery: any = { organizationId };
  if (fyRange.from || fyRange.to) {
    paymentQuery.paymentDate = {};
    if (fyRange.from) paymentQuery.paymentDate.$gte = fyRange.from;
    if (fyRange.to) {
      const end = fyRange.to;
      end.setHours(23, 59, 59, 999);
      paymentQuery.paymentDate.$lte = end;
    }
  }
  const [projects, payments, invoices, bankAccounts] = await Promise.all([
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    ProjectPayment.find(paymentQuery).populate("projectId createdBy invoiceId bankAccountId").sort({ paymentDate: -1 }).lean(),
    Invoice.find({ organizationId, status: { $ne: "void" } }).populate("clientId").sort({ invoiceDate: -1 }).lean(),
    BankAccount.find({ organizationId, active: true }).sort({ name: 1 }).lean()
  ]);
  const totalReceived = payments.reduce((sum: number, payment: any) => sum + (payment.amount ?? 0), 0);
  const clientProjectCount = projects.filter((project: any) => (project.projectType ?? "client") === "client").length;
  const internalProjectCount = projects.filter((project: any) => project.projectType === "internal").length;
  const receivedByProject = new Map<string, number>();
  for (const payment of payments as any[]) {
    const projectId = payment.projectId?._id?.toString?.() ?? payment.projectId?.toString?.();
    if (projectId) receivedByProject.set(projectId, (receivedByProject.get(projectId) ?? 0) + (payment.amount ?? 0));
  }
  const projectSummaries = projects.map((project: any) => {
    const received = (project.receivedAmount ?? 0) > 0 ? project.receivedAmount : (receivedByProject.get(project._id.toString()) ?? 0);
    return {
      ...project,
      received,
      due: Math.max((project.totalBudget ?? 0) - received, 0)
    };
  });
  return (
    <PageShell title="Project Payments" description="Track client payments by project. These records automatically update each project's received total.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Payment Received Till Now" value={totalReceived} currency />
        <StatCard label="Payment Records" value={payments.length} />
        <StatCard label="Client Projects" value={clientProjectCount} />
        <StatCard label="Internal Projects" value={internalProjectCount} />
      </div>
      <ProjectPaymentForm projects={JSON.parse(JSON.stringify(projects))} invoices={JSON.parse(JSON.stringify(invoices))} bankAccounts={JSON.parse(JSON.stringify(bankAccounts))} />
      <form className="filter-bar">
        <select className="native-control" name="fy" defaultValue={selectedFY}>
          <option value="all">All fiscal years</option>
          {fiscalYearOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value="custom">Custom date range</option>
        </select>
        <input className="native-control" type="date" name="from" defaultValue={params?.from ?? ""} />
        <input className="native-control" type="date" name="to" defaultValue={params?.to ?? ""} />
        <Button variant="outline">Filter</Button>
      </form>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Project Payment Summary</h2>
        <DataTable data={projectSummaries} pagination={{ basePath: "/project-payments", searchParams: params, pageParam: "summaryPage", pageSizeParam: "summaryPageSize" }} columns={[
          { header: "Project", cell: (p: any) => `${p.name} (${p.code})` },
          { header: "Type", cell: (p: any) => p.projectType === "internal" ? "Internal" : "Client" },
          { header: "Budget", cell: (p: any) => money(p.totalBudget ?? 0) },
          { header: "Received", cell: (p: any) => money(p.received ?? 0) },
          { header: "Due", cell: (p: any) => money(p.due ?? 0) }
        ]} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payment History</h2>
      <DataTable data={payments} pagination={{ basePath: "/project-payments", searchParams: params, pageParam: "historyPage", pageSizeParam: "historyPageSize" }} columns={[
        { header: "Date", cell: (p: any) => formatDate(p.paymentDate) },
        { header: "FY", cell: (p: any) => fiscalYearLabelForDate(p.paymentDate) },
        { header: "Project", cell: (p: any) => p.projectId?.name ?? "-" },
        { header: "Amount", cell: (p: any) => money(p.amount) },
        { header: "Invoice", cell: (p: any) => p.invoiceId?.invoiceNumber ?? "-" },
        { header: "Account", cell: (p: any) => p.bankAccountId?.name ?? "Default" },
        { header: "Note", cell: (p: any) => p.note || "-" },
        { header: "Added By", cell: (p: any) => p.createdBy?.name ?? "Unknown" },
        { header: "Receipt", cell: (p: any) => p.receiptImageId ? <Link className="text-primary hover:underline" href={`/api/receipts/${p.receiptImageId}`} target="_blank">View</Link> : "-" },
        { header: "Actions", cell: (p: any) => <form action={deleteProjectPayment}><input type="hidden" name="id" value={p._id.toString()} /><ConfirmButton /></form> }
      ]} />
      </section>
    </PageShell>
  );
}
