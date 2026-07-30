import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { LeadTask } from "@/models/LeadTask";
import { completeLeadTask, deleteLeadTask } from "@/actions/lead-tasks";

export default async function LeadTasksPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const statusFilter = typeof params?.status === "string" ? params.status : "";
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  if (statusFilter) query.status = statusFilter;
  const tasks = await LeadTask.find(query).sort({ createdAt: -1 }).populate("leadId", "name").populate("assigneeId", "name").lean() as any[];
  const canManage = ["owner", "admin"].includes(session.user.role);
  return (
    <PageShell title="Sales Tasks" description="Sales-specific tasks: call leads, send quotes, follow up." action={canManage && <Button asChild><Link href="/leads?action=newTask"><Plus className="h-4 w-4" />Create Task</Link></Button>}>
      <DataTable data={tasks} pagination={{ basePath: "/sales/tasks", searchParams: params }} columns={[
        { header: "Title", cell: (t: any) => <Link className={`font-medium hover:text-primary ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`} href={t.leadId ? `/leads/${t.leadId._id}` : "#"}>{t.title}</Link> },
        { header: "Lead", cell: (t: any) => t.leadId ? <Link className="hover:text-primary" href={`/leads/${t.leadId._id}`}>{t.leadId.name}</Link> : "-" },
        { header: "Status", cell: (t: any) => <Badge variant={t.status === "completed" ? "success" : t.status === "in_progress" ? "info" : "muted"}>{t.status.replace(/_/g, " ")}</Badge> },
        { header: "Assignee", cell: (t: any) => t.assigneeId?.name || "-" },
        { header: "Due", cell: (t: any) => t.dueDate ? <span className={t.dueDate < new Date() && t.status !== "completed" ? "text-destructive font-medium" : ""}>{formatDate(t.dueDate)}</span> : "-" },
        { header: "Actions", cell: (t: any) => <div className="flex gap-2">{canManage && t.status !== "completed" && <form action={completeLeadTask}><input type="hidden" name="id" value={t._id.toString()} /><Button variant="outline" size="sm">Complete</Button></form>}<form action={deleteLeadTask}><input type="hidden" name="id" value={t._id.toString()} /><ConfirmButton /></form></div> }
      ]} />
    </PageShell>
  );
}
