"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Flag, ImageIcon, ListChecks, MessageSquare, Pause, Play, Plus, TimerReset, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { addProjectTaskComment, bulkStartProjectTasks, createGlobalProjectTask, createProjectTask, deleteProjectTask, moveProjectTask, updateProjectTask, updateProjectTaskTimer } from "@/actions/project-tasks";
import { ActionMessage } from "@/components/action-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

const statuses = [
  { value: "to_do", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "complete", label: "Complete" }
] as const;

const fallbackColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be123c", "#4f46e5", "#0f766e", "#a16207"];

type ProjectTaskLike = any;

export function TaskKanban({
  projectId,
  tasks,
  projects,
  assignees,
  currentRole,
  title = "To Do Checklist"
}: {
  projectId?: string;
  tasks: ProjectTaskLike[];
  projects: any[];
  assignees: any[];
  currentRole: string;
  title?: string;
}) {
  const [items, setItems] = useState(tasks);
  const [selected, setSelected] = useState<ProjectTaskLike | null>(null);
  const [draggingId, setDraggingId] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [view, setView] = useState<"kanban" | "calendar" | "milestones" | "time">("kanban");
  const [isMoving, startMove] = useTransition();
  const [isBulkStarting, startBulkStart] = useTransition();
  const totalHours = items.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);
  const trackedSeconds = items.reduce((sum, task) => sum + elapsedForTask(task), 0);
  const overdueCount = items.filter((task) => isOverdue(task)).length;
  const canBulkStart = currentRole === "owner" || currentRole === "admin";

  useEffect(() => setItems(tasks), [tasks]);

  function onDrop(status: string) {
    const task = items.find((item) => item._id === draggingId);
    if (!task || task.status === status) return;
    const taskProjectId = getProjectId(task);
    const now = new Date().toISOString();
    const runningSeconds = task.timerStatus === "running" ? secondsSince(task.lastTimerStartedAt) : 0;
    setItems((current) => current.map((item) => {
      if (item._id !== task._id) return item;
      const next = { ...item, status };
      if (status === "in_progress" && item.timerStatus !== "running") {
        next.timerStatus = "running";
        next.startedAt = item.startedAt ?? now;
        next.lastTimerStartedAt = now;
      }
      if (status !== "in_progress" && item.timerStatus === "running") {
        next.timerStatus = status === "complete" ? "stopped" : "paused";
        next.accumulatedSeconds = Number(item.accumulatedSeconds ?? 0) + runningSeconds;
        next.lastTimerStartedAt = null;
      }
      return next;
    }));
    startMove(async () => {
      const result = await moveProjectTask(task._id, taskProjectId, status);
      if (result.ok) toast.success(result.message);
      else {
        toast.error(result.message);
        setItems(tasks);
      }
    });
  }

  function bulkStart() {
    if (!checkedIds.length) {
      toast.error("Select tasks to start");
      return;
    }
    startBulkStart(async () => {
      const result = await bulkStartProjectTasks(checkedIds);
      if (result.ok) {
        toast.success(result.message);
        const now = new Date().toISOString();
        setItems((current) => current.map((item) => checkedIds.includes(item._id) && item.status !== "complete" ? { ...item, status: "in_progress", timerStatus: "running", startedAt: item.startedAt ?? now, lastTimerStartedAt: now } : item));
        setCheckedIds([]);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{items.length} tasks</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Estimated</p>
          <p className="text-2xl font-semibold">{totalHours}h</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Tracked</p>
          <p className="text-2xl font-semibold">{formatDuration(trackedSeconds)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className="text-2xl font-semibold">{overdueCount}</p>
        </div>
        {statuses.map((status) => (
          <div key={status.value}>
            <p className="text-sm text-muted-foreground">{status.label}</p>
            <p className="text-2xl font-semibold">{items.filter((task) => task.status === status.value).length}</p>
          </div>
        ))}
      </div>

      <TaskCreateForm fixedProjectId={projectId} projects={projects} assignees={assignees} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ViewButton active={view === "kanban"} onClick={() => setView("kanban")} icon={<ListChecks className="h-4 w-4" />} label="Kanban" />
          <ViewButton active={view === "calendar"} onClick={() => setView("calendar")} icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
          <ViewButton active={view === "milestones"} onClick={() => setView("milestones")} icon={<Flag className="h-4 w-4" />} label="Milestones" />
          <ViewButton active={view === "time"} onClick={() => setView("time")} icon={<Clock className="h-4 w-4" />} label="Time Report" />
        </div>
        {canBulkStart && (
          <Button type="button" variant="outline" size="sm" disabled={isBulkStarting || checkedIds.length === 0} onClick={bulkStart}>
            <TimerReset className="h-4 w-4" />
            {isBulkStarting ? "Starting..." : `Start Selected (${checkedIds.length})`}
          </Button>
        )}
      </div>

      {view === "kanban" && <div className="grid gap-4 xl:grid-cols-4">
        {statuses.map((status) => {
          const columnTasks = items.filter((task) => task.status === status.value);
          return (
            <div
              key={status.value}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(status.value)}
              className="min-h-[260px] rounded-lg border bg-card p-3 transition-colors data-[moving=true]:opacity-75"
              data-moving={isMoving}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{status.label}</h3>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span>
              </div>
              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <CompactTaskCard
                    key={task._id}
                    task={task}
                    checked={checkedIds.includes(task._id)}
                    canSelect={canBulkStart}
                    onChecked={(checked) => setCheckedIds((current) => checked ? [...new Set([...current, task._id])] : current.filter((id) => id !== task._id))}
                    onOpen={() => setSelected(task)}
                    onDragStart={() => setDraggingId(task._id)}
                  />
                ))}
                {!columnTasks.length && <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Drop tasks here</div>}
              </div>
            </div>
          );
        })}
      </div>}

      {view === "calendar" && <CalendarView tasks={items} onOpen={setSelected} />}
      {view === "milestones" && <MilestoneView tasks={items} onOpen={setSelected} />}
      {view === "time" && <TimeReportView tasks={items} />}

      {selected && (
        <TaskDetailDialog
          task={items.find((item) => item._id === selected._id) ?? selected}
          assignees={assignees}
          currentRole={currentRole}
          onClose={() => setSelected(null)}
          onLocalUpdate={(updated) => setItems((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated } : item))}
        />
      )}
    </section>
  );
}

function TaskCreateForm({ fixedProjectId, projects, assignees }: { fixedProjectId?: string; projects: any[]; assignees: any[] }) {
  const action = fixedProjectId ? createProjectTask.bind(null, fixedProjectId) : createGlobalProjectTask;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-4 rounded-lg border bg-card p-4 sm:p-5 md:grid-cols-2">
      <Field name="title" label="Task" placeholder="Task title" />
      {!fixedProjectId && (
        <div className="space-y-2">
          <Label>Project</Label>
          <ProjectSelect projects={projects} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Status</Label>
        <StatusSelect />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Priority</Label>
          <PrioritySelect />
        </div>
        <div className="space-y-2">
          <Label>Severity</Label>
          <SeveritySelect />
        </div>
      </div>
      <Field name="dueDate" label="Due Date" type="date" />
      <Field name="milestone" label="Milestone" placeholder="Sprint 1, QA, Launch" />
      <div className="space-y-2">
        <Label>Assign To</Label>
        <AssigneeChecklist assignees={assignees} />
      </div>
      <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue="0" />
      <div className="space-y-2">
        <Label>Task Color</Label>
        <Input name="color" type="color" defaultValue="#2563eb" className="h-10 p-1" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Description</Label>
        <Textarea name="description" placeholder="Task details" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Task Attachments</Label>
        <Input name="attachments" type="file" accept="image/*" multiple />
      </div>
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? "Adding..." : "Add Task"}
        </Button>
      </div>
    </form>
  );
}

function CompactTaskCard({ task, checked, canSelect, onChecked, onOpen, onDragStart }: { task: ProjectTaskLike; checked: boolean; canSelect: boolean; onChecked: (checked: boolean) => void; onOpen: () => void; onDragStart: () => void }) {
  const elapsed = useLiveElapsed(task);
  const estimateSeconds = Number(task.estimatedHours ?? 0) * 3600;
  const overdue = estimateSeconds > 0 && elapsed >= estimateSeconds && task.status !== "complete";
  const color = task.color || fallbackColor(task._id);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="w-full rounded-md border bg-background p-3 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-2 text-sm font-semibold">{task.title}</h4>
        </button>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {statusLabel(task.status)}
        </span>
      </div>
      <button type="button" onClick={onOpen} className="mt-3 block w-full text-left">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(elapsed)} / {formatHours(task.estimatedHours)}</span>
          <span className="truncate">{task.timerStatus === "running" ? "Running" : assigneeNames(task)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{priorityLabel(task.priority)}</span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{severityLabel(task.severity)}</span>
          {task.dueDate && <span className={isOverdue(task) ? "rounded-md bg-destructive/10 px-2 py-0.5 text-destructive" : "rounded-md bg-muted px-2 py-0.5 text-muted-foreground"}>{dateLabel(task.dueDate)}</span>}
        </div>
      </button>
      {canSelect && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
          Bulk start
        </label>
      )}
    </div>
  );
}

function TaskDetailDialog({ task, assignees, currentRole, onClose, onLocalUpdate }: { task: ProjectTaskLike; assignees: any[]; currentRole: string; onClose: () => void; onLocalUpdate: (task: ProjectTaskLike) => void }) {
  const projectId = getProjectId(task);
  const [state, formAction, pending] = useActionState(updateProjectTask.bind(null, task._id, projectId), initialState);
  const [isTimerPending, startTimerTransition] = useTransition();
  const elapsed = useLiveElapsed(task);
  const color = task.color || fallbackColor(task._id);

  function timer(command: "start" | "pause" | "stop") {
    const now = new Date().toISOString();
    const runningSeconds = task.timerStatus === "running" ? secondsSince(task.lastTimerStartedAt) : 0;
    const accumulatedSeconds = Number(task.accumulatedSeconds ?? 0) + runningSeconds;
    const optimistic: ProjectTaskLike = { ...task };
    if (command === "start") {
      optimistic.timerStatus = "running";
      optimistic.startedAt = optimistic.startedAt ?? now;
      optimistic.lastTimerStartedAt = now;
      optimistic.completedAt = null;
      if (optimistic.status === "to_do") optimistic.status = "in_progress";
    }
    if (command === "pause") {
      optimistic.timerStatus = "paused";
      optimistic.accumulatedSeconds = accumulatedSeconds;
      optimistic.lastTimerStartedAt = null;
    }
    if (command === "stop") {
      optimistic.timerStatus = "stopped";
      optimistic.status = "complete";
      optimistic.completedAt = now;
      optimistic.accumulatedSeconds = accumulatedSeconds;
      optimistic.lastTimerStartedAt = null;
    }
    onLocalUpdate(optimistic);
    startTimerTransition(async () => {
      const result = await updateProjectTaskTimer(task._id, projectId, command);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-foreground/45 p-3 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close task details" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card p-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-2 h-1.5 w-24 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-lg font-semibold">{task.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusLabel(task.status)} · {formatDuration(elapsed)} tracked · {formatHours(task.estimatedHours)} estimate
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close task details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_220px]">
          <form action={formAction} encType="multipart/form-data" className="space-y-4">
            <Field name="title" label="Task" defaultValue={task.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <StatusSelect defaultValue={task.status} />
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <AssigneeChecklist assignees={assignees} selectedIds={taskAssigneeIds(task)} compact />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <PrioritySelect defaultValue={task.priority ?? "medium"} />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <SeveritySelect defaultValue={task.severity ?? "normal"} />
              </div>
              <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue={task.estimatedHours ?? 0} />
              <Field name="dueDate" label="Due Date" type="date" defaultValue={dateInputValue(task.dueDate)} />
              <Field name="milestone" label="Milestone" defaultValue={task.milestone ?? ""} />
              <div className="space-y-2">
                <Label>Task Color</Label>
                <Input name="color" type="color" defaultValue={color} className="h-10 p-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={task.description} rows={5} />
            </div>
            <div className="space-y-2">
              <Label>Add Attachments</Label>
              <Input name="attachments" type="file" accept="image/*" multiple />
            </div>
            <AttachmentList task={task} />
            <ActionMessage state={state} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending}>{pending ? "Saving..." : "Save Changes"}</Button>
            </div>
            <TaskComments task={task} projectId={projectId} />
            <TaskActivity task={task} />
          </form>

          <aside className="space-y-3 rounded-lg border bg-background p-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Project</p>
              <Link className="text-sm font-medium text-primary hover:underline" href={`/projects/${projectId}`}>{task.projectId?.name ?? "Project"}</Link>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Assigned</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {taskAssignees(task).length ? taskAssignees(task).map((user: any) => (
                  <span key={user._id ?? user} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    <UsersRound className="h-3 w-3" />
                    {user.name ?? "User"}
                  </span>
                )) : <p className="text-sm font-medium">Unassigned</p>}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Added By</p>
              <p className="text-sm font-medium">{task.createdBy?.name ?? "Unknown"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-muted-foreground">Timer</p>
              <p className="mt-1 text-2xl font-semibold">{formatDuration(elapsed)}</p>
              <p className="text-xs text-muted-foreground">Estimate {formatHours(task.estimatedHours)}</p>
            </div>
            <div className="grid gap-2">
              <Button type="button" size="sm" disabled={isTimerPending || task.timerStatus === "running"} onClick={() => timer("start")}>
                <Play className="h-4 w-4" /> Start
              </Button>
              {currentRole !== "staff" && (
                <Button type="button" variant="outline" size="sm" disabled={isTimerPending || task.timerStatus !== "running"} onClick={() => timer("pause")}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              )}
              <Button type="button" variant="secondary" size="sm" disabled={isTimerPending || task.status === "complete"} onClick={() => timer("stop")}>
                <CheckCircle2 className="h-4 w-4" /> Complete
              </Button>
            </div>
            <form action={deleteProjectTask}>
              <input type="hidden" name="taskId" value={task._id} />
              <input type="hidden" name="projectId" value={projectId} />
              <ConfirmButton label="Delete" variant="outline" className="w-full text-destructive" />
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProjectSelect({ projects }: { projects: any[] }) {
  return (
    <Select name="projectId" required defaultValue="">
      <option value="" disabled>Select project</option>
      {projects.map((project) => (
        <option key={project._id} value={project._id}>{project.name} ({project.code})</option>
      ))}
    </Select>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

function StatusSelect({ defaultValue = "to_do" }: { defaultValue?: string }) {
  return (
    <Select name="status" defaultValue={defaultValue}>
      {statuses.map((status) => (
        <option key={status.value} value={status.value}>{status.label}</option>
      ))}
    </Select>
  );
}

function PrioritySelect({ defaultValue = "medium" }: { defaultValue?: string }) {
  return (
    <Select name="priority" defaultValue={defaultValue}>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </Select>
  );
}

function SeveritySelect({ defaultValue = "normal" }: { defaultValue?: string }) {
  return (
    <Select name="severity" defaultValue={defaultValue}>
      <option value="minor">Minor</option>
      <option value="normal">Normal</option>
      <option value="major">Major</option>
      <option value="critical">Critical</option>
    </Select>
  );
}

function AssigneeChecklist({ assignees, selectedIds = [], compact = false }: { assignees: any[]; selectedIds?: string[]; compact?: boolean }) {
  const selected = new Set(selectedIds);
  return (
    <div className={`grid gap-2 rounded-md border bg-background p-2 ${compact ? "max-h-36 overflow-y-auto" : "sm:grid-cols-2"}`}>
      {assignees.length ? assignees.map((user) => {
        const id = user._id?.toString?.() ?? String(user._id);
        return (
          <label key={id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <input name="assigneeIds" type="checkbox" value={id} defaultChecked={selected.has(id)} className="h-4 w-4 rounded border-input accent-primary" />
            <span className="truncate">{user.name} <span className="text-xs text-muted-foreground">({user.role})</span></span>
          </label>
        );
      }) : <p className="px-2 py-1.5 text-sm text-muted-foreground">No staff/admin users</p>}
    </div>
  );
}

function AttachmentList({ task }: { task: ProjectTaskLike }) {
  const ids = Array.from(new Set([task.imageId, ...(task.attachmentIds ?? [])].map((id: any) => id?.toString?.() ?? id).filter(Boolean)));
  if (!ids.length) return null;
  return (
    <div className="space-y-2">
      <Label>Attachments</Label>
      <div className="flex flex-wrap gap-2">
        {ids.map((id, index) => (
          <Button key={id} asChild variant="outline" size="sm">
            <Link href={`/api/receipts/${id}`} target="_blank"><ImageIcon className="h-4 w-4" /> Image {index + 1}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function TaskComments({ task, projectId }: { task: ProjectTaskLike; projectId: string }) {
  const [state, formAction, pending] = useActionState(addProjectTaskComment.bind(null, task._id, projectId), initialState);
  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Comments</h3>
      </div>
      <div className="max-h-44 space-y-2 overflow-y-auto">
        {(task.comments ?? []).length ? task.comments.map((comment: any, index: number) => (
          <div key={`${comment.createdAt}-${index}`} className="rounded-md bg-muted p-2 text-sm">
            <p>{comment.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{comment.userId?.name ?? "User"} · {dateTimeLabel(comment.createdAt)}</p>
          </div>
        )) : <p className="text-sm text-muted-foreground">No comments yet</p>}
      </div>
      <form action={formAction} className="space-y-2">
        <Textarea name="message" placeholder="Add comment" rows={2} />
        <div className="flex items-center justify-between gap-2">
          <ActionMessage state={state} />
          <Button size="sm" disabled={pending}>{pending ? "Adding..." : "Comment"}</Button>
        </div>
      </form>
    </div>
  );
}

function TaskActivity({ task }: { task: ProjectTaskLike }) {
  const events = [...(task.activity ?? [])].reverse().slice(0, 8);
  if (!events.length) return null;
  return (
    <div className="space-y-2 rounded-lg border bg-background p-3">
      <h3 className="text-sm font-semibold">Activity</h3>
      <div className="space-y-2">
        {events.map((event: any, index: number) => (
          <div key={`${event.createdAt}-${index}`} className="flex items-start gap-2 text-sm">
            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <p><span className="font-medium">{event.userId?.name ?? "User"}</span> {String(event.action).replaceAll("_", " ")} <span className="text-xs text-muted-foreground">{dateTimeLabel(event.createdAt)}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarView({ tasks, onOpen }: { tasks: ProjectTaskLike[]; onOpen: (task: ProjectTaskLike) => void }) {
  const groups = groupBy(tasks, (task) => task.dueDate ? dateInputValue(task.dueDate) : "No due date");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Object.entries(groups).map(([date, groupedTasks]) => (
        <div key={date} className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> {date === "No due date" ? date : dateLabel(date)}</h3>
          <div className="space-y-2">
            {groupedTasks.map((task) => <MiniTaskRow key={task._id} task={task} onOpen={() => onOpen(task)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function MilestoneView({ tasks, onOpen }: { tasks: ProjectTaskLike[]; onOpen: (task: ProjectTaskLike) => void }) {
  const groups = groupBy(tasks, (task) => task.milestone || "Unplanned");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Object.entries(groups).map(([milestone, groupedTasks]) => {
        const done = groupedTasks.filter((task) => task.status === "complete").length;
        const percent = groupedTasks.length ? Math.round((done / groupedTasks.length) * 100) : 0;
        return (
          <div key={milestone} className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Flag className="h-4 w-4" /> {milestone}</h3>
              <span className="text-xs text-muted-foreground">{percent}% complete</span>
            </div>
            <div className="mb-3 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
            <div className="space-y-2">
              {groupedTasks.map((task) => <MiniTaskRow key={task._id} task={task} onOpen={() => onOpen(task)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeReportView({ tasks }: { tasks: ProjectTaskLike[] }) {
  const byAssignee = new Map<string, { name: string; seconds: number; tasks: number }>();
  const byProject = new Map<string, { name: string; seconds: number; tasks: number }>();
  for (const task of tasks) {
    const seconds = elapsedForTask(task);
    const assignees = taskAssignees(task);
    if (!assignees.length) assignees.push({ _id: "unassigned", name: "Unassigned" });
    for (const assignee of assignees) {
      const key = assignee?._id?.toString?.() ?? String(assignee);
      const current = byAssignee.get(key) ?? { name: assignee?.name ?? "User", seconds: 0, tasks: 0 };
      current.seconds += seconds;
      current.tasks += 1;
      byAssignee.set(key, current);
    }
    const projectKey = getProjectId(task);
    const projectCurrent = byProject.get(projectKey) ?? { name: task.projectId?.name ?? "Project", seconds: 0, tasks: 0 };
    projectCurrent.seconds += seconds;
    projectCurrent.tasks += 1;
    byProject.set(projectKey, projectCurrent);
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportTable title="Time By Staff" rows={[...byAssignee.values()]} />
      <ReportTable title="Time By Project" rows={[...byProject.values()]} />
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: Array<{ name: string; seconds: number; tasks: number }> }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b p-4"><h3 className="text-sm font-semibold">{title}</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Name</th><th className="p-3">Tasks</th><th className="p-3 text-right">Tracked</th></tr>
        </thead>
        <tbody>
          {rows.sort((a, b) => b.seconds - a.seconds).map((row) => (
            <tr key={row.name} className="border-t">
              <td className="p-3 font-medium">{row.name}</td>
              <td className="p-3">{row.tasks}</td>
              <td className="p-3 text-right">{formatDuration(row.seconds)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No tracked time</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MiniTaskRow({ task, onOpen }: { task: ProjectTaskLike; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center justify-between gap-3 rounded-md border bg-background p-3 text-left hover:border-primary/40">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{task.title}</span>
        <span className="text-xs text-muted-foreground">{statusLabel(task.status)} · {assigneeNames(task)}</span>
      </span>
      {isOverdue(task) && <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />}
    </button>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}

function useLiveElapsed(task: ProjectTaskLike) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (task.timerStatus !== "running") return undefined;
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [task.timerStatus]);
  return useMemo(() => Number(task.accumulatedSeconds ?? 0) + (task.timerStatus === "running" ? secondsSince(task.lastTimerStartedAt) : 0), [task.accumulatedSeconds, task.lastTimerStartedAt, task.timerStatus, tick]);
}

function secondsSince(value: string | Date | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 1000));
}

function elapsedForTask(task: ProjectTaskLike) {
  return Number(task.accumulatedSeconds ?? 0) + (task.timerStatus === "running" ? secondsSince(task.lastTimerStartedAt) : 0);
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
}

function dateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateLabel(value: string | Date | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dateTimeLabel(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isOverdue(task: ProjectTaskLike) {
  if (!task.dueDate || task.status === "complete") return false;
  const due = new Date(task.dueDate).getTime();
  return !Number.isNaN(due) && due < Date.now();
}

function formatHours(hours: number | string | null | undefined) {
  const value = Number(hours ?? 0);
  return `${Number.isInteger(value) ? value : value.toFixed(2)}h`;
}

function priorityLabel(value: string | null | undefined) {
  const labels: Record<string, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
  return labels[value ?? ""] ?? "Medium";
}

function severityLabel(value: string | null | undefined) {
  const labels: Record<string, string> = { minor: "Minor", normal: "Normal", major: "Major", critical: "Critical" };
  return labels[value ?? ""] ?? "Normal";
}

function statusLabel(value: string) {
  return statuses.find((status) => status.value === value)?.label ?? value;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
}

function getProjectId(task: ProjectTaskLike) {
  return task.projectId?._id ?? task.projectId;
}

function taskAssignees(task: ProjectTaskLike) {
  const multi = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
  if (multi.length) return multi;
  return task.assigneeId ? [task.assigneeId] : [];
}

function taskAssigneeIds(task: ProjectTaskLike) {
  return taskAssignees(task).map((user: any) => user?._id?.toString?.() ?? user?.toString?.() ?? String(user)).filter(Boolean);
}

function assigneeNames(task: ProjectTaskLike) {
  const names = taskAssignees(task).map((user: any) => user?.name).filter(Boolean);
  if (!names.length) return "Unassigned";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function fallbackColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 2147483647;
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}
