import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { AuditLog } from "@/models/AuditLog";

export default async function AuditLogsPage() {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const logs = await AuditLog.find({ organizationId }).populate("userId").sort({ createdAt: -1 }).limit(200).lean();
  return (
    <PageShell title="Audit Logs">
      <DataTable data={logs} columns={[
        { header: "Date", cell: (l: any) => formatDate(l.createdAt) },
        { header: "User", cell: (l: any) => l.userId?.name ?? "Unknown" },
        { header: "Action", cell: (l: any) => l.action },
        { header: "Entity", cell: (l: any) => l.entityType },
        { header: "Metadata", cell: (l: any) => <code className="text-xs">{JSON.stringify(l.metadata ?? {})}</code> }
      ]} />
    </PageShell>
  );
}
