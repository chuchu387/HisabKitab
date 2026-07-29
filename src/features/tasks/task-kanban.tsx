"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Download, Flag, ImageIcon, ListChecks, MessageSquare, Pause, Play, Plus, TimerReset, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { addProjectTaskComment, bulkStartProjectTasks, createGlobalProjectTask, createProjectTask, deleteProjectTask, moveProjectTask, updateProjectTask, updateProjectTaskTimer } from "@/actions/project-tasks";
import { createTaskFolder, updateTaskFolder } from "@/actions/task-folders";
import { ActionMessage } from "@/components/action-message";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

const statuses = [
  { value: "to_do", label: "To Do", color: "#2563eb", tint: "rgba(37, 99, 235, 0.08)" },
  { value: "in_progress", label: "In Progress", color: "#ea580c", tint: "rgba(234, 88, 12, 0.09)" },
  { value: "in_review", label: "In Review", color: "#9333ea", tint: "rgba(147, 51, 234, 0.08)" },
  { value: "complete", label: "Complete", color: "#16a34a", tint: "rgba(22, 163, 74, 0.08)" }
] as const;

const fallbackColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be123c", "#4f46e5", "#0f766e", "#a16207"];

type ProjectTaskLike = any;

export function TaskKanban({
  projectId,
  tasks,
  projects,
  folders,
  assignees,
  currentRole,
  taskPermissions,
  defaultFolderId = "",
  title = "To Do Checklist"
}: {
  projectId?: string;
  tasks: ProjectTaskLike[];
  projects: any[];
  folders: any[];
  assignees: any[];
  currentRole: string;
  taskPermissions: any;
  defaultFolderId?: string;
  title?: string;
}) {
  const [items, setItems] = useState(tasks);
  const [selected, setSelected] = useState<ProjectTaskLike | null>(null);
  const [draggingId, setDraggingId] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [view, setView] = useState<"kanban" | "calendar" | "milestones" | "time" | "sla">("kanban");
  const [queryString, setQueryString] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [isMoving, startMove] = useTransition();
  const [isBulkStarting, startBulkStart] = useTransition();
  const totalHours = items.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);
  const trackedSeconds = items.reduce((sum, task) => sum + elapsedForTask(task), 0);
  const overdueCount = items.filter((task) => isOverdue(task)).length;
  const canBulkStart = currentRole === "owner" || currentRole === "admin";

  useEffect(() => setItems(tasks), [tasks]);
  useEffect(() => setQueryString(window.location.search), []);

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
    <section className="space-y-3">
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-semibold">{items.length} tasks</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
            <CompactMetric label="Estimate" value={`${totalHours}h`} />
            <CompactMetric label="Tracked" value={formatDuration(trackedSeconds)} />
            <CompactMetric label="Overdue" value={overdueCount} danger={overdueCount > 0} />
            {statuses.map((status) => (
              <CompactMetric key={status.value} label={status.label} value={items.filter((task) => task.status === status.value).length} color={status.color} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ViewButton active={view === "kanban"} onClick={() => setView("kanban")} icon={<ListChecks className="h-4 w-4" />} label="Kanban" />
          <ViewButton active={view === "calendar"} onClick={() => setView("calendar")} icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
          <ViewButton active={view === "milestones"} onClick={() => setView("milestones")} icon={<Flag className="h-4 w-4" />} label="Milestones" />
          <ViewButton active={view === "time"} onClick={() => setView("time")} icon={<Clock className="h-4 w-4" />} label="Time Report" />
          <ViewButton active={view === "sla"} onClick={() => setView("sla")} icon={<AlertTriangle className="h-4 w-4" />} label="SLA" />
        </div>
        <div className="flex flex-wrap gap-2">
          {taskPermissions.canCreateFolder && (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowFolders((value) => !value)}>
              <Flag className="h-4 w-4" />
              {showFolders ? "Hide Folders" : "Task Folders"}
            </Button>
          )}
          {taskPermissions.canCreateTask && <Button type="button" variant="default" size="sm" onClick={() => setShowCreate((value) => !value)}>
            <Plus className="h-4 w-4" />
            {showCreate ? "Hide Form" : "New Task"}
          </Button>}
          {canBulkStart && (
            <Button type="button" variant="outline" size="sm" disabled={isBulkStarting || checkedIds.length === 0} onClick={bulkStart}>
              <TimerReset className="h-4 w-4" />
              {isBulkStarting ? "Starting..." : `Start Selected (${checkedIds.length})`}
            </Button>
          )}
        </div>
      </div>

      {showFolders && <TaskFolderManager folders={folders} projects={projects} canManageProjects={taskPermissions.canManageFolderProjects} />}
      {showCreate && <TaskCreateForm fixedProjectId={projectId} projects={projects} folders={folders} assignees={assignees} canAssign={taskPermissions.canAssignTask} defaultFolderId={defaultFolderId} />}

      {view === "kanban" && <div className="grid gap-4 xl:grid-cols-4">
        {statuses.map((status) => {
          const columnTasks = items.filter((task) => task.status === status.value);
          return (
            <div
              key={status.value}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(status.value)}
              className="flex max-h-[min(72vh,760px)] min-h-[260px] flex-col overflow-hidden rounded-lg border bg-card transition-colors data-[moving=true]:opacity-75"
              data-moving={isMoving}
              style={{ borderTopColor: status.color, boxShadow: `inset 0 3px 0 ${status.color}` }}
            >
              <div className="flex items-center justify-between border-b p-3" style={{ backgroundColor: status.tint }}>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.label}
                </h3>
                <span className="rounded-md bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 overscroll-contain">
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
      {view === "time" && <TimeReportView tasks={items} queryString={queryString} />}
      {view === "sla" && <SlaReportView tasks={items} queryString={queryString} onOpen={setSelected} />}

      {selected && (
        <TaskDetailDialog
          task={items.find((item) => item._id === selected._id) ?? selected}
          folders={folders}
          assignees={assignees}
          currentRole={currentRole}
          canAssign={taskPermissions.canAssignTask}
          onClose={() => setSelected(null)}
          onLocalUpdate={(updated) => setItems((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated } : item))}
        />
      )}
    </section>
  );
}

function TaskCreateForm({ fixedProjectId, projects, folders, assignees, canAssign, defaultFolderId = "" }: { fixedProjectId?: string; projects: any[]; folders: any[]; assignees: any[]; canAssign: boolean; defaultFolderId?: string }) {
  const action = fixedProjectId ? createProjectTask.bind(null, fixedProjectId) : createGlobalProjectTask;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [folderId, setFolderId] = useState(defaultFolderId);
  const folder = folders.find((item) => item._id === folderId);
  const availableProjects = folder ? (folder.projectIds ?? []) : projects;
  const availableFolders = fixedProjectId
    ? folders.filter((item) => (item.projectIds ?? []).some((project: any) => (project._id ?? project)?.toString?.() === fixedProjectId || String(project._id ?? project) === fixedProjectId))
    : folders;

  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-3 rounded-lg border bg-card p-3 sm:p-4 md:grid-cols-4">
      <Field name="title" label="Task" placeholder="Task title" />
      <div className="space-y-2">
        <Label>Folder</Label>
        <Select name="folderId" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
          <option value="">Unfiled</option>
          {availableFolders.map((folder) => <option key={folder._id} value={folder._id}>{folder.name}</option>)}
        </Select>
      </div>
      {!fixedProjectId && (
        <div className="space-y-2">
          <Label>Project</Label>
          <ProjectSelect projects={availableProjects} />
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
      {canAssign && <div className="space-y-2 md:col-span-2">
        <Label>Assign To</Label>
        <AssigneeChecklist assignees={assignees} />
      </div>}
      <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue="0" />
      <div className="space-y-2">
        <Label>Task Color</Label>
        <Input name="color" type="color" defaultValue="#2563eb" className="h-10 p-1" />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Description</Label>
        <Textarea name="description" placeholder="Task details" />
      </div>
      <div className="space-y-2 md:col-span-4">
        <Label>Task Attachments</Label>
        <Input name="attachments" type="file" accept="image/*" multiple />
      </div>
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between md:col-span-4">
        <ActionMessage state={state} />
        <Button disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? "Adding..." : "Add Task"}
        </Button>
      </div>
    </form>
  );
}

function TaskFolderManager({ folders, projects, canManageProjects }: { folders: any[]; projects: any[]; canManageProjects: boolean }) {
  const [state, formAction, pending] = useActionState(createTaskFolder, initialState);
  return (
    <div className="grid gap-4 rounded-lg border bg-card p-3 sm:p-4 xl:grid-cols-[360px_1fr]">
      <form action={formAction} className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Create Task Folder</h3>
          <p className="text-xs text-muted-foreground">Group projects first, then create tasks inside that project context.</p>
        </div>
        <Field name="name" label="Folder Name" placeholder="Sharp Line QA" />
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea name="description" placeholder="What this folder is for" rows={3} />
        </div>
        <ProjectChecklist projects={projects} disabled={!canManageProjects} />
        <input type="hidden" name="active" value="true" />
        <ActionMessage state={state} />
        <Button size="sm" disabled={pending}>{pending ? "Creating..." : "Create Folder"}</Button>
      </form>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Folders</h3>
        <div className="grid max-h-[360px] gap-3 overflow-y-auto overscroll-contain pr-1 md:grid-cols-2">
          {folders.length ? folders.map((folder) => (
            <TaskFolderCard key={folder._id} folder={folder} projects={projects} canManageProjects={canManageProjects} />
          )) : <p className="text-sm text-muted-foreground">No task folders yet</p>}
        </div>
      </div>
    </div>
  );
}

function TaskFolderCard({ folder, projects, canManageProjects }: { folder: any; projects: any[]; canManageProjects: boolean }) {
  const [state, formAction, pending] = useActionState(updateTaskFolder.bind(null, folder._id), initialState);
  return (
    <form action={formAction} className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <Field name="name" label="Folder" defaultValue={folder.name} />
        <Button asChild variant="outline" size="sm" className="mt-7 shrink-0">
          <Link href={`/tasks/folders/${folder._id}`}>Open</Link>
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea name="description" defaultValue={folder.description} rows={2} />
      </div>
      <ProjectChecklist projects={projects} selectedIds={(folder.projectIds ?? []).map((project: any) => project._id?.toString?.() ?? project.toString())} disabled={!canManageProjects} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={folder.active ?? true} className="h-4 w-4 rounded border-input accent-primary" /> Active</label>
      <ActionMessage state={state} />
      <Button size="sm" variant="outline" disabled={pending || !canManageProjects}>{pending ? "Saving..." : "Save Folder"}</Button>
    </form>
  );
}

function ProjectChecklist({ projects, selectedIds = [], disabled = false }: { projects: any[]; selectedIds?: string[]; disabled?: boolean }) {
  const selected = new Set(selectedIds);
  return (
    <div className="space-y-2">
      <Label>Projects</Label>
      <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border bg-card p-2 overscroll-contain">
        {projects.length ? projects.map((project) => {
          const id = project._id?.toString?.() ?? String(project._id);
          return (
            <label key={id} className="flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <input name="projectIds" type="checkbox" value={id} defaultChecked={selected.has(id)} disabled={disabled} className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50" />
              <span className="truncate">{project.name} <span className="text-xs text-muted-foreground">({project.code})</span></span>
            </label>
          );
        }) : <p className="px-2 py-1.5 text-sm text-muted-foreground">No projects available</p>}
      </div>
    </div>
  );
}

function CompactTaskCard({ task, checked, canSelect, onChecked, onOpen, onDragStart }: { task: ProjectTaskLike; checked: boolean; canSelect: boolean; onChecked: (checked: boolean) => void; onOpen: () => void; onDragStart: () => void }) {
  const elapsed = useLiveElapsed(task);
  const estimateSeconds = Number(task.estimatedHours ?? 0) * 3600;
  const overdue = estimateSeconds > 0 && elapsed >= estimateSeconds && task.status !== "complete";
  const extraSeconds = overrunSeconds(task, elapsed);
  const color = task.color || fallbackColor(task._id);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="w-full rounded-md border bg-background px-2.5 py-2 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-2 text-sm font-semibold">{task.title}</h4>
        </button>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {statusLabel(task.status)}
        </span>
      </div>
      <button type="button" onClick={onOpen} className="mt-2 block w-full text-left">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(elapsed)} / {formatHours(task.estimatedHours)}</span>
          <span className="truncate">{task.timerStatus === "running" ? "Running" : assigneeNames(task)}</span>
        </div>
        {extraSeconds > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Extra {formatDuration(extraSeconds)}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{priorityLabel(task.priority)}</span>
          {task.dueDate && <span className={isOverdue(task) ? "rounded bg-destructive/10 px-1.5 py-0.5 text-destructive" : "rounded bg-muted px-1.5 py-0.5 text-muted-foreground"}>{dateLabel(task.dueDate)}</span>}
        </div>
      </button>
      {canSelect && (
        <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} className="h-3.5 w-3.5 rounded border-input accent-primary" />
          Bulk start
        </label>
      )}
    </div>
  );
}

function TaskDetailDialog({ task, folders, assignees, currentRole, canAssign, onClose, onLocalUpdate }: { task: ProjectTaskLike; folders: any[]; assignees: any[]; currentRole: string; canAssign: boolean; onClose: () => void; onLocalUpdate: (task: ProjectTaskLike) => void }) {
  const projectId = getProjectId(task);
  const [state, formAction, pending] = useActionState(updateProjectTask.bind(null, task._id, projectId), initialState);
  const [isTimerPending, startTimerTransition] = useTransition();
  const elapsed = useLiveElapsed(task);
  const extraSeconds = overrunSeconds(task, elapsed);
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
      <div role="dialog" aria-modal="true" className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-lg border bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card p-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-2 h-1.5 w-24 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-lg font-semibold">{task.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusLabel(task.status)} · {formatDuration(elapsed)} tracked · {formatHours(task.estimatedHours)} estimate
              {extraSeconds > 0 ? ` · ${formatDuration(extraSeconds)} extra` : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close task details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form action={formAction} encType="multipart/form-data" className="space-y-4">
            <Field name="title" label="Task" defaultValue={task.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <StatusSelect defaultValue={task.status} />
              </div>
              <div className="space-y-2">
                <Label>Folder</Label>
                <FolderSelect folders={folders} projectId={projectId} defaultValue={task.folderId?._id ?? task.folderId ?? ""} />
              </div>
              {canAssign && <div className="space-y-2">
                <Label>Assign To</Label>
                <AssigneeChecklist assignees={assignees} selectedIds={taskAssigneeIds(task)} compact />
              </div>}
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
              {extraSeconds > 0 && <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">Extra time {formatDuration(extraSeconds)}</p>}
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
            <TaskComments task={task} projectId={projectId} />
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

function FolderSelect({ folders, projectId, defaultValue = "" }: { folders: any[]; projectId: string; defaultValue?: string }) {
  const availableFolders = folders.filter((folder) => (folder.projectIds ?? []).some((project: any) => {
    const id = project._id?.toString?.() ?? project.toString();
    return id === projectId;
  }));
  return (
    <Select name="folderId" defaultValue={defaultValue}>
      <option value="">Unfiled</option>
      {availableFolders.map((folder) => <option key={folder._id} value={folder._id}>{folder.name}</option>)}
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

function CompactMetric({ label, value, color, danger = false }: { label: string; value: string | number; color?: string; danger?: boolean }) {
  return (
    <div className="min-w-[92px] rounded-md border bg-background px-2.5 py-2">
      <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
        {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </p>
      <p className={danger ? "text-base font-semibold text-destructive" : "text-base font-semibold"}>{value}</p>
    </div>
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
  const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
    if (a === "No due date") return 1;
    if (b === "No due date") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Due Today" value={tasks.filter((task) => dueBucket(task) === "today").length} />
        <MetricTile label="Overdue" value={tasks.filter((task) => isOverdue(task)).length} tone="danger" />
        <MetricTile label="No Due Date" value={tasks.filter((task) => !task.dueDate).length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {sortedEntries.map(([date, groupedTasks]) => (
          <div key={date} className="flex max-h-[440px] flex-col overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-4" style={{ backgroundColor: date === "No due date" ? "rgba(107,114,128,.08)" : isPastDate(date) ? "rgba(220,38,38,.08)" : "rgba(8,145,178,.08)" }}>
              <h3 className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {date === "No due date" ? date : dateLabel(date)}</span>
                <span className="rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">{groupedTasks.length}</span>
              </h3>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 overscroll-contain">
            {groupedTasks.map((task) => <MiniTaskRow key={task._id} task={task} onOpen={() => onOpen(task)} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneView({ tasks, onOpen }: { tasks: ProjectTaskLike[]; onOpen: (task: ProjectTaskLike) => void }) {
  const groups = groupBy(tasks, (task) => task.milestone || "Unplanned");
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Object.entries(groups).map(([milestone, groupedTasks]) => {
        const done = groupedTasks.filter((task) => task.status === "complete").length;
        const running = groupedTasks.filter((task) => task.status === "in_progress").length;
        const review = groupedTasks.filter((task) => task.status === "in_review").length;
        const extra = groupedTasks.reduce((sum, task) => sum + overrunSeconds(task), 0);
        const percent = groupedTasks.length ? Math.round((done / groupedTasks.length) * 100) : 0;
        return (
          <div key={milestone} className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold"><Flag className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{milestone}</span></h3>
                <span className="text-xs font-medium text-muted-foreground">{percent}% complete</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-muted p-2"><p className="font-semibold">{groupedTasks.length}</p><p className="text-muted-foreground">Tasks</p></div>
                <div className="rounded bg-orange-500/10 p-2"><p className="font-semibold">{running}</p><p className="text-muted-foreground">Active</p></div>
                <div className="rounded bg-purple-500/10 p-2"><p className="font-semibold">{review}</p><p className="text-muted-foreground">Review</p></div>
                <div className={extra > 0 ? "rounded bg-destructive/10 p-2 text-destructive" : "rounded bg-muted p-2"}><p className="font-semibold">{formatDuration(extra)}</p><p className="text-muted-foreground">Extra</p></div>
              </div>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto p-3 overscroll-contain">
              {groupedTasks.map((task) => <MiniTaskRow key={task._id} task={task} onOpen={() => onOpen(task)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimeReportView({ tasks, queryString }: { tasks: ProjectTaskLike[]; queryString: string }) {
  const byAssignee = new Map<string, { name: string; seconds: number; extraSeconds: number; tasks: number }>();
  const byProject = new Map<string, { name: string; seconds: number; extraSeconds: number; tasks: number }>();
  for (const task of tasks) {
    const seconds = elapsedForTask(task);
    const extraSeconds = overrunSeconds(task, seconds);
    const assignees = taskAssignees(task);
    if (!assignees.length) assignees.push({ _id: "unassigned", name: "Unassigned" });
    for (const assignee of assignees) {
      const key = assignee?._id?.toString?.() ?? String(assignee);
      const current = byAssignee.get(key) ?? { name: assignee?.name ?? "User", seconds: 0, extraSeconds: 0, tasks: 0 };
      current.seconds += seconds;
      current.extraSeconds += extraSeconds;
      current.tasks += 1;
      byAssignee.set(key, current);
    }
    const projectKey = getProjectId(task);
    const projectCurrent = byProject.get(projectKey) ?? { name: task.projectId?.name ?? "Project", seconds: 0, extraSeconds: 0, tasks: 0 };
    projectCurrent.seconds += seconds;
    projectCurrent.extraSeconds += extraSeconds;
    projectCurrent.tasks += 1;
    byProject.set(projectKey, projectCurrent);
  }
  return (
    <div className="space-y-4">
      <ReportHeader title="Task Time Report" description="Tracked task time grouped by staff and project." exportType="time" queryString={queryString} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Tracked Time" value={formatDuration(tasks.reduce((sum, task) => sum + elapsedForTask(task), 0))} />
        <MetricTile label="Extra Time" value={formatDuration(tasks.reduce((sum, task) => sum + overrunSeconds(task), 0))} tone="danger" />
        <MetricTile label="Running Timers" value={tasks.filter((task) => task.timerStatus === "running").length} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ReportTable title="Time By Staff" rows={[...byAssignee.values()]} />
        <ReportTable title="Time By Project" rows={[...byProject.values()]} />
      </div>
    </div>
  );
}

function SlaReportView({ tasks, queryString, onOpen }: { tasks: ProjectTaskLike[]; queryString: string; onOpen: (task: ProjectTaskLike) => void }) {
  const estimatedTasks = tasks.filter((task) => Number(task.estimatedHours ?? 0) > 0);
  const overrunTasks = estimatedTasks
    .map((task) => ({ task, extraSeconds: overrunSeconds(task), elapsed: elapsedForTask(task) }))
    .filter((item) => item.extraSeconds > 0)
    .sort((a, b) => b.extraSeconds - a.extraSeconds);
  const runningOverrun = overrunTasks.filter((item) => item.task.timerStatus === "running").length;
  const onTime = estimatedTasks.length - overrunTasks.length;
  const overrunRate = estimatedTasks.length ? Math.round((overrunTasks.length / estimatedTasks.length) * 100) : 0;
  const totalExtra = overrunTasks.reduce((sum, item) => sum + item.extraSeconds, 0);

  return (
    <div className="space-y-4">
      <ReportHeader title="Task SLA Report" description="Estimated versus actual task timing and overrun exceptions." exportType="sla" queryString={queryString} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SlaCard label="Estimated Tasks" value={estimatedTasks.length} />
        <SlaCard label="On Time" value={onTime} />
        <SlaCard label="Overrun Rate" value={`${overrunRate}%`} tone={overrunRate > 30 ? "danger" : "normal"} />
        <SlaCard label="Total Extra Time" value={formatDuration(totalExtra)} tone={totalExtra > 0 ? "danger" : "normal"} />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h3 className="text-sm font-semibold">Task SLA Exceptions</h3>
            <p className="text-xs text-muted-foreground">{runningOverrun} running tasks are already beyond estimate.</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Task</th><th className="p-3">Status</th><th className="p-3">Assignee</th><th className="p-3 text-right">Estimate</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Extra</th></tr>
          </thead>
          <tbody>
            {overrunTasks.map(({ task, extraSeconds, elapsed }) => (
              <tr key={task._id} className="border-t">
                <td className="max-w-[320px] p-3">
                  <button type="button" onClick={() => onOpen(task)} className="truncate font-medium text-primary hover:underline">{task.title}</button>
                </td>
                <td className="p-3">{statusLabel(task.status)}</td>
                <td className="p-3">{assigneeNames(task)}</td>
                <td className="p-3 text-right">{formatHours(task.estimatedHours)}</td>
                <td className="p-3 text-right">{formatDuration(elapsed)}</td>
                <td className="p-3 text-right font-medium text-destructive">{formatDuration(extraSeconds)}</td>
              </tr>
            ))}
            {!overrunTasks.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No SLA overruns for the selected tasks</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SlaCard({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4" : "rounded-lg border bg-card p-4"}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "mt-1 text-2xl font-semibold text-destructive" : "mt-1 text-2xl font-semibold"}>{value}</p>
    </div>
  );
}

function ReportHeader({ title, description, exportType, queryString }: { title: string; description: string; exportType: "time" | "sla"; queryString: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={taskExportHref(exportType, "csv", queryString)}><Download className="h-4 w-4" /> CSV</a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={taskExportHref(exportType, "pdf", queryString)}><Download className="h-4 w-4" /> PDF</a>
        </Button>
      </div>
    </div>
  );
}

function MetricTile({ label, value, tone = "normal" }: { label: string; value: string | number; tone?: "normal" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-lg border border-destructive/30 bg-destructive/5 p-4" : "rounded-lg border bg-card p-4"}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "mt-1 text-2xl font-semibold text-destructive" : "mt-1 text-2xl font-semibold"}>{value}</p>
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: Array<{ name: string; seconds: number; extraSeconds: number; tasks: number }> }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b p-4"><h3 className="text-sm font-semibold">{title}</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr><th className="p-3">Name</th><th className="p-3">Tasks</th><th className="p-3 text-right">Tracked</th><th className="p-3 text-right">Extra</th></tr>
        </thead>
        <tbody>
          {rows.sort((a, b) => b.seconds - a.seconds).map((row) => (
            <tr key={row.name} className="border-t">
              <td className="p-3 font-medium">{row.name}</td>
              <td className="p-3">{row.tasks}</td>
              <td className="p-3 text-right">{formatDuration(row.seconds)}</td>
              <td className={row.extraSeconds > 0 ? "p-3 text-right font-medium text-destructive" : "p-3 text-right text-muted-foreground"}>{row.extraSeconds > 0 ? formatDuration(row.extraSeconds) : "-"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No tracked time</td></tr>}
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

function overrunSeconds(task: ProjectTaskLike, elapsed = elapsedForTask(task)) {
  const estimateSeconds = Number(task.estimatedHours ?? 0) * 3600;
  if (!estimateSeconds) return 0;
  return Math.max(0, elapsed - estimateSeconds);
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

function isPastDate(value: string) {
  if (value === "No due date") return false;
  const date = new Date(value).getTime();
  return !Number.isNaN(date) && date < new Date(new Date().toDateString()).getTime();
}

function dueBucket(task: ProjectTaskLike) {
  if (!task.dueDate) return "none";
  const date = new Date(task.dueDate);
  if (Number.isNaN(date.getTime())) return "none";
  const start = new Date(new Date().toDateString()).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  const time = date.getTime();
  if (time < start) return "overdue";
  if (time <= end) return "today";
  return "upcoming";
}

function taskExportHref(type: "time" | "sla", format: "csv" | "pdf", queryString: string) {
  const params = new URLSearchParams(queryString.startsWith("?") ? queryString.slice(1) : queryString);
  params.set("type", type);
  params.set("format", format);
  return `/api/tasks/export?${params.toString()}`;
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
