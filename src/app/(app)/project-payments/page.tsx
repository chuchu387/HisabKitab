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

void Project;
void User;

export default async function ProjectPaymentsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const [projects, payments] = await Promise.all([
    Project.find({ organizationId }).sort({ name: 1 }).lean(),
    ProjectPayment.find({ organizationId }).populate("projectId createdBy").sort({ paymentDate: -1 }).lean()
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
      <ProjectPaymentForm projects={JSON.parse(JSON.stringify(projects))} />
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
        { header: "Project", cell: (p: any) => p.projectId?.name ?? "-" },
        { header: "Amount", cell: (p: any) => money(p.amount) },
        { header: "Note", cell: (p: any) => p.note || "-" },
        { header: "Added By", cell: (p: any) => p.createdBy?.name ?? "Unknown" },
        { header: "Receipt", cell: (p: any) => p.receiptImageId ? <Link className="text-primary hover:underline" href={`/api/receipts/${p.receiptImageId}`} target="_blank">View</Link> : "-" },
        { header: "Actions", cell: (p: any) => <form action={deleteProjectPayment}><input type="hidden" name="id" value={p._id.toString()} /><ConfirmButton /></form> }
      ]} />
      </section>
    </PageShell>
  );
}
