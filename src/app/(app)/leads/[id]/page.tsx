import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money, safeObjectId } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { LeadActivity } from "@/models/LeadActivity";
import { LeadTask } from "@/models/LeadTask";
import { Proposal } from "@/models/Proposal";
import { Campaign } from "@/models/Campaign";
import { addLeadActivity, convertLeadToClient, updateLeadFollowUp, updateLeadStatus } from "@/actions/leads";
import { leadStatusLabels, leadStatusColors, leadSourceLabels, leadActivityTypes, leadTaskStatuses } from "@/constants";
import { ActivityForm } from "./activity-form";
import { ConvertForm } from "./convert-form";
import { FollowUpForm } from "./followup-form";
import { LogEmail } from "@/features/leads/log-email";

export default async function LeadDetailPage({ params }: any) {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner", "admin", "staff"]);
  await connectToDatabase();
  const routeParams = await params;
  const leadObjectId = safeObjectId(routeParams.id);
  if (!leadObjectId) notFound();
  const lead = await Lead.findOne({ _id: routeParams.id, organizationId }).populate("assignedTo", "name").populate("createdBy", "name").lean() as any;
  if (!lead) notFound();
  const [activities, tasks, proposals] = await Promise.all([
    LeadActivity.find({ leadId: lead._id, organizationId }).sort({ createdAt: -1 }).populate("userId", "name").lean(),
    LeadTask.find({ leadId: lead._id, organizationId }).sort({ createdAt: -1 }).populate("assigneeId", "name").lean(),
    Proposal.find({ leadId: lead._id, organizationId }).sort({ createdAt: -1 }).lean()
  ]);
  const campaign: any = lead.campaignId ? await Campaign.findOne({ _id: lead.campaignId, organizationId }).lean() : null;
  const canManage = ["owner", "admin"].includes(session.user.role);
  const isConverted = lead.convertedToClientId || lead.status === "won" || lead.status === "lost";
  return (
    <PageShell title={lead.name} description={lead.company || lead.email || lead.phone || ""} breadcrumb={[{ label: "Leads", href: "/leads" }, { label: lead.name }]} action={canManage && !isConverted && <Button asChild><Link href={`/leads/${routeParams.id}/edit`}>Edit Lead</Link></Button>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Status" value={<Badge variant={(leadStatusColors[lead.status as keyof typeof leadStatusColors] || "default") as any}>{leadStatusLabels[lead.status as keyof typeof leadStatusLabels]}</Badge>} />
        <InfoCard label="Source" value={leadSourceLabels[lead.source as keyof typeof leadSourceLabels] || lead.source} />
        <InfoCard label="Estimated Value" value={lead.estimatedValue ? money(lead.estimatedValue) : "-"} />
        <InfoCard label="Assigned To" value={lead.assignedTo?.name || "-"} />
        <InfoCard label="Email" value={lead.email ? <div className="flex items-center gap-2"><a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a><LogEmail leadId={lead._id.toString()} email={lead.email} /></div> : "-"} />
        <InfoCard label="Phone" value={lead.phone ? <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a> : "-"} />
        <InfoCard label="Follow-up Date" value={lead.followUpDate ? formatDate(lead.followUpDate) : "-"} />
        <InfoCard label="Created" value={formatDate(lead.createdAt)} />
        <InfoCard label="Score" value={<span className={lead.score >= 60 ? "text-primary font-semibold" : lead.score >= 30 ? "text-accent" : "text-muted-foreground"}>{lead.score}/100</span>} />
        {campaign && <InfoCard label="Campaign" value={campaign.name} />}
      </div>

      {lead.notes && (
        <Card>
          <CardContent className="p-4 text-sm sm:p-5"><p className="text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap">{lead.notes}</p></CardContent>
        </Card>
      )}

      {!isConverted && canManage && (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <h3 className="font-semibold">Pipeline Actions</h3>
            <div className="flex flex-wrap gap-2">
              {(["new", "contacted", "meeting_scheduled", "proposal_sent", "negotiation", "won", "lost"] as const).map((status) => {
                const isCurrent = lead.status === status;
                const colorMap: Record<string, string> = { new: "info", contacted: "warning", meeting_scheduled: "info", proposal_sent: "warning", negotiation: "warning", won: "success", lost: "muted" };
                return (
                  <form key={status} action={updateLeadStatus.bind(null, lead._id.toString(), status)}>
                    <Button type="submit" variant={isCurrent ? "default" : "outline"} size="sm" disabled={isCurrent}>{leadStatusLabels[status]}</Button>
                  </form>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!isConverted && canManage && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <h3 className="font-semibold">Convert to Client</h3>
            <ConvertForm leadId={lead._id.toString()} leadName={lead.name} />
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Activity Timeline</h2>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <ActivityForm leadId={lead._id.toString()} />
          </CardContent>
        </Card>
        <div className="space-y-2">
          {activities.map((activity: any) => (
            <Card key={activity._id}>
              <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                <Badge variant="info" className="shrink-0">{activity.type.replace(/_/g, " ")}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{activity.userId?.name ?? "Unknown"} · {formatDate(activity.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {!activities.length && <p className="text-sm text-muted-foreground">No activities recorded yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <DataTable data={tasks} columns={[
          { header: "Title", cell: (task: any) => task.title },
          { header: "Status", cell: (task: any) => <Badge variant={task.status === "completed" ? "success" : "warning"}>{task.status}</Badge> },
          { header: "Due", cell: (task: any) => task.dueDate ? formatDate(task.dueDate) : "-" },
          { header: "Assignee", cell: (task: any) => task.assigneeId?.name || "-" }
        ]} />
      </section>

      {proposals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Proposals</h2>
          <DataTable data={proposals} columns={[
            { header: "Title", cell: (p: any) => <Link className="font-medium hover:text-primary" href={`/sales/proposals/${p._id}`}>{p.title}</Link> },
            { header: "Amount", cell: (p: any) => money(p.amount) },
            { header: "Status", cell: (p: any) => <Badge variant={p.status === "accepted" ? "success" : p.status === "rejected" ? "danger" : "info"}>{p.status}</Badge> }
          ]} />
        </section>
      )}
    </PageShell>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 font-medium">{value}</div></CardContent>
    </Card>
  );
}
