import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { cn, formatDate, money } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { updateLeadStatus } from "@/actions/leads";
import { leadStatusLabels, leadStatusColors, leadSourceLabels } from "@/constants";

const pipelineStages = ["new", "contacted", "meeting_scheduled", "proposal_sent", "negotiation", "won", "lost"] as const;

function getScoreColor(score: number) {
  if (score >= 70) return "text-primary";
  if (score >= 40) return "text-accent";
  return "text-muted-foreground";
}

function getScoreBg(score: number) {
  if (score >= 70) return "bg-primary/10";
  if (score >= 40) return "bg-accent/10";
  return "bg-muted/30";
}

function daysSince(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default async function PipelinePage() {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const leads = await Lead.find({ organizationId: oid }).sort({ createdAt: -1 }).populate("assignedTo", "name").lean() as any[];
  const columns = pipelineStages.map((stage) => ({
    stage,
    label: leadStatusLabels[stage],
    leads: leads.filter((lead: any) => lead.status === stage)
  }));
  return (
    <PageShell title="Sales Pipeline" description="Drag leads through the sales stages. Use the status buttons to move leads forward." action={<Button asChild><Link href="/leads/new"><Plus className="h-4 w-4" />New Lead</Link></Button>}>
      <div className="grid gap-4 overflow-x-auto lg:grid-cols-7">
        {columns.map((column) => (
          <div key={column.stage} className="min-w-56 space-y-3">
            <div className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{column.leads.length}</span>
                  {column.stage === "won" && <span className="text-xs font-medium text-primary">{money(column.leads.reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0))}</span>}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {column.leads.map((lead: any) => (
                <Card key={lead._id} className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="space-y-2.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/leads/${lead._id}`} className="block font-medium leading-tight hover:text-primary">{lead.name}</Link>
                      {lead.score > 0 && (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none", getScoreBg(lead.score), getScoreColor(lead.score))}>
                          {lead.score}
                        </span>
                      )}
                    </div>
                    {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                    {lead.source && <Badge variant="info" className="text-[10px]">{leadSourceLabels[lead.source as keyof typeof leadSourceLabels] || lead.source}</Badge>}
                    <div className="flex items-center justify-between gap-2">
                      {lead.estimatedValue > 0 ? (
                        <span className="text-sm font-semibold">{money(lead.estimatedValue)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No value</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{daysSince(lead.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 border-t pt-2 text-[10px] text-muted-foreground">
                      {lead.followUpDate && <span>Follow: {formatDate(lead.followUpDate)}</span>}
                      {lead.assignedTo && <span className="text-right">{lead.assignedTo.name}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {pipelineStages.map((nextStage) => {
                        if (nextStage === column.stage) return null;
                        return (
                          <form key={nextStage} action={updateLeadStatus.bind(null, lead._id.toString(), nextStage)}>
                            <Button type="submit" variant="ghost" size="sm" className="text-[10px] px-1.5 py-0.5 h-auto">{leadStatusLabels[nextStage]}</Button>
                          </form>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!column.leads.length && (
                <Card className="border-dashed">
                  <CardContent className="p-4 text-center text-sm text-muted-foreground">No leads</CardContent>
                </Card>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
