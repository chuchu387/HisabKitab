import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { EmailLog } from "@/models/EmailLog";

const statusVariants = {
  sent: "success",
  failed: "danger",
  skipped: "warning"
} as const;

export default async function EmailLogsPage({ searchParams }: any) {
  const session = await requireRole(["super_admin", "owner", "admin"]);
  if (session.user.role !== "super_admin" && !session.user.organizationId) redirect("/organizations");
  await connectToDatabase();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q.trim() : "";
  const status = typeof params?.status === "string" ? params.status : "";
  const template = typeof params?.template === "string" ? params.template : "";
  const query: Record<string, unknown> = {};
  if (session.user.role !== "super_admin") query.organizationId = session.user.organizationId;
  if (status) query.status = status;
  if (template) query.template = template;
  if (q) {
    query.$or = [
      { subject: { $regex: q, $options: "i" } },
      { template: { $regex: q, $options: "i" } },
      { "recipients.email": { $regex: q, $options: "i" } }
    ];
  }

  const [logs, sentCount, failedCount, skippedCount] = await Promise.all([
    EmailLog.find(query).sort({ createdAt: -1 }).limit(500).lean(),
    EmailLog.countDocuments({ ...(session.user.role !== "super_admin" ? { organizationId: session.user.organizationId } : {}), status: "sent" }),
    EmailLog.countDocuments({ ...(session.user.role !== "super_admin" ? { organizationId: session.user.organizationId } : {}), status: "failed" }),
    EmailLog.countDocuments({ ...(session.user.role !== "super_admin" ? { organizationId: session.user.organizationId } : {}), status: "skipped" })
  ]);

  return (
    <PageShell title="Email Audit" description="Track every Brevo email attempt, delivery status, recipient, and failure reason.">
      <div className="grid gap-4 sm:grid-cols-3">
        <AuditMetric label="Sent" value={sentCount} variant="sent" />
        <AuditMetric label="Failed" value={failedCount} variant="failed" />
        <AuditMetric label="Skipped" value={skippedCount} variant="skipped" />
      </div>
      <form className="filter-bar">
        <SearchBar placeholder="Search subject, template, recipient" defaultValue={q} />
        <select className="native-control" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <select className="native-control" name="template" defaultValue={template}>
          <option value="">All templates</option>
          <option value="password_reset">Password reset</option>
          <option value="user_created">User created</option>
          <option value="task_assigned">Task assigned</option>
          <option value="expense_submitted">Expense submitted</option>
          <option value="expense_approval">Expense approval</option>
          <option value="project_payment_received">Payment received</option>
          <option value="payment_due_reminder">Payment due reminder</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <DataTable
        data={logs}
        pagination={{ basePath: "/email-logs", searchParams: params }}
        columns={[
          { header: "Date", cell: (log: any) => formatDate(log.createdAt) },
          { header: "Status", cell: (log: any) => <Badge variant={statusVariants[log.status as keyof typeof statusVariants] ?? "muted"}>{log.status}</Badge> },
          { header: "Template", cell: (log: any) => log.template },
          { header: "Subject", cell: (log: any) => <div className="max-w-md"><p className="font-medium">{log.subject}</p><p className="text-xs text-muted-foreground">{log.entityType || "Email"} {log.entityId || ""}</p></div> },
          { header: "Recipients", cell: (log: any) => log.recipients?.map((recipient: any) => recipient.email).join(", ") || "-" },
          { header: "Provider", cell: (log: any) => `${log.provider}${log.responseStatus ? ` ${log.responseStatus}` : ""}` },
          { header: "Error", cell: (log: any) => <span className="line-clamp-2 max-w-sm text-xs text-muted-foreground">{log.error || log.responseBody || "-"}</span> }
        ]}
      />
    </PageShell>
  );
}

function AuditMetric({ label, value, variant }: { label: string; value: number; variant: "sent" | "failed" | "skipped" }) {
  const colors = {
    sent: "border-primary/20 bg-primary/10 text-primary",
    failed: "border-destructive/20 bg-destructive/10 text-destructive",
    skipped: "border-accent/20 bg-accent/10 text-accent-foreground"
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[variant]}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
