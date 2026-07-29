"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock, ImageIcon, Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createGlobalProjectTask, createProjectTask, deleteProjectTask, moveProjectTask, updateProjectTask, updateProjectTaskTimer } from "@/actions/project-tasks";
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
  title = "To Do Checklist"
}: {
  projectId?: string;
  tasks: ProjectTaskLike[];
  projects: any[];
  assignees: any[];
  title?: string;
}) {
  const [items, setItems] = useState(tasks);
  const [selected, setSelected] = useState<ProjectTaskLike | null>(null);
  const [draggingId, setDraggingId] = useState("");
  const [isMoving, startMove] = useTransition();
  const totalHours = items.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);

  useEffect(() => setItems(tasks), [tasks]);

  function onDrop(status: string) {
    const task = items.find((item) => item._id === draggingId);
    if (!task || task.status === status) return;
    const taskProjectId = getProjectId(task);
    setItems((current) => current.map((item) => item._id === task._id ? { ...item, status } : item));
    startMove(async () => {
      const result = await moveProjectTask(task._id, taskProjectId, status);
      if (result.ok) toast.success(result.message);
      else {
        toast.error(result.message);
        setItems(tasks);
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
        {statuses.map((status) => (
          <div key={status.value}>
            <p className="text-sm text-muted-foreground">{status.label}</p>
            <p className="text-2xl font-semibold">{items.filter((task) => task.status === status.value).length}</p>
          </div>
        ))}
      </div>

      <TaskCreateForm fixedProjectId={projectId} projects={projects} assignees={assignees} />

      <div className="grid gap-4 xl:grid-cols-4">
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
                  <CompactTaskCard key={task._id} task={task} onOpen={() => setSelected(task)} onDragStart={() => setDraggingId(task._id)} />
                ))}
                {!columnTasks.length && <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Drop tasks here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <TaskDetailDialog
          task={items.find((item) => item._id === selected._id) ?? selected}
          assignees={assignees}
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
      <div className="space-y-2">
        <Label>Assign To</Label>
        <AssigneeSelect assignees={assignees} />
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
        <Label>Task Image</Label>
        <Input name="image" type="file" accept="image/*" />
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

function CompactTaskCard({ task, onOpen, onDragStart }: { task: ProjectTaskLike; onOpen: () => void; onDragStart: () => void }) {
  const elapsed = useLiveElapsed(task);
  const estimateSeconds = Number(task.estimatedHours ?? 0) * 3600;
  const overdue = estimateSeconds > 0 && elapsed >= estimateSeconds && task.status !== "complete";
  const color = task.color || fallbackColor(task._id);

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="w-full rounded-md border bg-background p-3 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-semibold">{task.title}</h4>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {statusLabel(task.status)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(elapsed)} / {formatHours(task.estimatedHours)}</span>
        <span>{task.timerStatus === "running" ? "Running" : task.assigneeId?.name ?? "Unassigned"}</span>
      </div>
    </button>
  );
}

function TaskDetailDialog({ task, assignees, onClose, onLocalUpdate }: { task: ProjectTaskLike; assignees: any[]; onClose: () => void; onLocalUpdate: (task: ProjectTaskLike) => void }) {
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
                <AssigneeSelect assignees={assignees} defaultValue={task.assigneeId?._id ?? task.assigneeId ?? ""} />
              </div>
              <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue={task.estimatedHours ?? 0} />
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
              <Label>Replace Image</Label>
              <Input name="image" type="file" accept="image/*" />
            </div>
            <ActionMessage state={state} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending}>{pending ? "Saving..." : "Save Changes"}</Button>
              {task.imageId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/api/receipts/${task.imageId}`} target="_blank"><ImageIcon className="h-4 w-4" /> View Image</Link>
                </Button>
              )}
            </div>
          </form>

          <aside className="space-y-3 rounded-lg border bg-background p-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Project</p>
              <Link className="text-sm font-medium text-primary hover:underline" href={`/projects/${projectId}`}>{task.projectId?.name ?? "Project"}</Link>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Assigned</p>
              <p className="text-sm font-medium">{task.assigneeId?.name ?? "Unassigned"}</p>
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
              <Button type="button" variant="outline" size="sm" disabled={isTimerPending || task.timerStatus !== "running"} onClick={() => timer("pause")}>
                <Pause className="h-4 w-4" /> Pause
              </Button>
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

function StatusSelect({ defaultValue = "to_do" }: { defaultValue?: string }) {
  return (
    <Select name="status" defaultValue={defaultValue}>
      {statuses.map((status) => (
        <option key={status.value} value={status.value}>{status.label}</option>
      ))}
    </Select>
  );
}

function AssigneeSelect({ assignees, defaultValue = "" }: { assignees: any[]; defaultValue?: string }) {
  return (
    <Select name="assigneeId" defaultValue={defaultValue}>
      <option value="">Unassigned</option>
      {assignees.map((user) => (
        <option key={user._id} value={user._id}>{user.name} ({user.role})</option>
      ))}
    </Select>
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

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
}

function formatHours(hours: number | string | null | undefined) {
  const value = Number(hours ?? 0);
  return `${Number.isInteger(value) ? value : value.toFixed(2)}h`;
}

function statusLabel(value: string) {
  return statuses.find((status) => status.value === value)?.label ?? value;
}

function getProjectId(task: ProjectTaskLike) {
  return task.projectId?._id ?? task.projectId;
}

function fallbackColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) % 2147483647;
  return fallbackColors[Math.abs(hash) % fallbackColors.length];
}
