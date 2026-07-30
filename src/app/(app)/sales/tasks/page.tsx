import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { LeadTask } from "@/models/LeadTask";
import { deleteLeadTask, updateLeadTaskStatus } from "@/actions/lead-tasks";
import { leadTaskStatusLabels, leadTaskStatusColors } from "@/constants";

const stages = ["to_contact", "contacted", "follow_up", "proposal", "converted", "closed"] as const;

export default async function SalesTasksKanbanPage() {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const tasks = await LeadTask.find({ organizationId: oid }).sort({ createdAt: -1 }).populate("leadId", "name").populate("assigneeId", "name").lean() as any[];
  const canManage = ["owner", "admin"].includes(session.user.role);
  const columns = stages.map((stage) => ({
    stage,
    label: leadTaskStatusLabels[stage],
    tasks: tasks.filter((t: any) => t.status === stage)
  }));
  return (
    <PageShell
      title="Sales Tasks"
      description="Marketing task board: move tasks through the pipeline."
      action={canManage && <Button asChild><Link href="/leads?action=newTask"><Plus className="h-4 w-4" />Create Task</Link></Button>}
    >
      <div className="grid gap-4 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(240px, 1fr))` }}>
        {columns.map((col) => (
          <div key={col.stage} className="min-w-[240px] space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 shadow-sm">
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <span className="text-xs text-muted-foreground">{col.tasks.length}</span>
            </div>
            <div className="space-y-2">
              {col.tasks.map((task: any) => (
                <Card key={task._id}>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">
                          {task.leadId ? <Link href={`/leads/${task.leadId._id}`} className="hover:text-primary">{task.title}</Link> : task.title}
                        </p>
                        <Badge variant={(leadTaskStatusColors as any)[task.status] as any} className="shrink-0 text-[10px]">{leadTaskStatusLabels[task.status as keyof typeof leadTaskStatusLabels]}</Badge>
                      </div>
                      {task.leadId && <p className="text-xs text-muted-foreground">Lead: {task.leadId.name}</p>}
                      {task.assigneeId && <p className="text-xs text-muted-foreground">Assignee: {task.assigneeId.name}</p>}
                      {task.dueDate && <p className={`text-xs ${task.dueDate < new Date() && task.status !== "closed" ? "text-destructive font-medium" : "text-muted-foreground"}`}>Due: {formatDate(task.dueDate)}</p>}
                      {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {stages.map((s) => {
                          if (s === task.status) return null;
                          return (
                            <form key={s} action={updateLeadTaskStatus.bind(null, task._id.toString(), s)}>
                              <Button type="submit" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]">{leadTaskStatusLabels[s]}</Button>
                            </form>
                          );
                        })}
                        {canManage && (
                          <form action={deleteLeadTask}>
                            <input type="hidden" name="id" value={task._id.toString()} />
                            <ConfirmButton className="h-6 px-1.5 text-[10px]" />
                          </form>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!col.tasks.length && <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
