import { Types } from "mongoose";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { ReminderRunForm } from "@/features/payment-reminders/reminder-run-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Client } from "@/models/Client";
import { EmailLog } from "@/models/EmailLog";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";

export default async function PaymentRemindersPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const oid = new Types.ObjectId(organizationId);
  const [projects, lastPayments, lastReminders] = await Promise.all([
    Project.find({ organizationId, projectType: "client", totalBudget: { $gt: 0 } }).populate({ path: "clientId", model: Client, select: "name email contactPerson" }).sort({ endDate: 1 }).lean(),
    ProjectPayment.aggregate([
      { $match: { organizationId: oid } },
      { $sort: { paymentDate: -1 } },
      { $group: { _id: "$projectId", lastPaymentDate: { $first: "$paymentDate" }, totalPaid: { $sum: "$amount" } } }
    ]),
    EmailLog.aggregate([
      { $match: { organizationId: oid, template: "payment_due_reminder", entityType: "Project" } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$entityId", lastReminderAt: { $first: "$createdAt" }, lastStatus: { $first: "$status" } } }
    ])
  ]);
  const paymentByProject = new Map(lastPayments.map((row: any) => [row._id?.toString?.(), row]));
  const reminderByProject = new Map(lastReminders.map((row: any) => [row._id, row]));
  const rows = (projects as any[]).map((project) => {
    const paid = project.receivedAmount ?? paymentByProject.get(project._id.toString())?.totalPaid ?? 0;
    const due = Math.max((project.totalBudget ?? 0) - paid, 0);
    return {
      ...project,
      clientName: project.clientId?.name ?? "No Client",
      clientEmail: project.clientId?.email ?? "",
      paid,
      due,
      lastPaymentDate: paymentByProject.get(project._id.toString())?.lastPaymentDate,
      lastReminderAt: reminderByProject.get(project._id.toString())?.lastReminderAt,
      lastReminderStatus: reminderByProject.get(project._id.toString())?.lastStatus
    };
  }).filter((project) => project.due > 0);
  const dueTotal = rows.reduce((sum, project) => sum + project.due, 0);
  const missingEmail = rows.filter((project) => !project.clientEmail).length;

  return (
    <PageShell title="Payment Reminders" description="Send due payment reminders to client project contacts and track every attempt in Email Audit.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects With Due" value={rows.length} />
        <StatCard label="Total Due" value={dueTotal} currency />
        <StatCard label="Missing Client Email" value={missingEmail} />
        <StatCard label="Ready To Send" value={rows.length - missingEmail} />
      </div>
      <ReminderRunForm />
      <DataTable
        data={rows}
        pagination={{ basePath: "/payment-reminders", searchParams: params }}
        columns={[
          { header: "Project", cell: (project: any) => `${project.name} (${project.code})` },
          { header: "Client", cell: (project: any) => <div><p>{project.clientName}</p><p className="text-xs text-muted-foreground">{project.clientEmail || "Missing email"}</p></div> },
          { header: "Budget", cell: (project: any) => money(project.totalBudget ?? 0) },
          { header: "Received", cell: (project: any) => money(project.paid ?? 0) },
          { header: "Due", cell: (project: any) => money(project.due ?? 0) },
          { header: "End Date", cell: (project: any) => formatDate(project.endDate) },
          { header: "Last Payment", cell: (project: any) => formatDate(project.lastPaymentDate) },
          { header: "Last Reminder", cell: (project: any) => project.lastReminderAt ? <div><p>{formatDate(project.lastReminderAt)}</p><Badge variant={project.lastReminderStatus === "sent" ? "success" : project.lastReminderStatus === "failed" ? "danger" : "warning"}>{project.lastReminderStatus}</Badge></div> : "-" }
        ]}
      />
    </PageShell>
  );
}
