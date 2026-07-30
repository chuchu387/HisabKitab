import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { updateLeadStatus } from "@/actions/leads";
import { leadStatusLabels, leadStatusColors } from "@/constants";

const pipelineStages = ["new", "contacted", "meeting_scheduled", "proposal_sent", "negotiation", "won", "lost"] as const;

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
                <Badge variant={(leadStatusColors[column.stage] || "default") as any}>{column.leads.length}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              {column.leads.map((lead: any) => (
                <Card key={lead._id} className="shadow-sm">
                  <CardContent className="space-y-2 p-3">
                    <Link href={`/leads/${lead._id}`} className="block font-medium hover:text-primary">{lead.name}</Link>
                    {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                    {lead.estimatedValue > 0 && <p className="text-sm font-semibold">{money(lead.estimatedValue)}</p>}
                    {lead.followUpDate && <p className="text-xs text-muted-foreground">Follow-up: {formatDate(lead.followUpDate)}</p>}
                    {lead.assignedTo && <p className="text-xs text-muted-foreground">{lead.assignedTo.name}</p>}
                    <div className="flex flex-wrap gap-1 pt-1">
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
