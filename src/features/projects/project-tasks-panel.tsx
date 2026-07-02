"use client";

import Link from "next/link";
import { Clock, ImageIcon, Plus, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { createProjectTask, deleteProjectTask, updateProjectTask } from "@/actions/project-tasks";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

const statusGroups = [
  { value: "to_do", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "complete", label: "Complete" }
] as const;

export function ProjectTasksPanel({ projectId, tasks, assignees }: { projectId: string; tasks: any[]; assignees: any[] }) {
  const [state, formAction, pending] = useActionState(createProjectTask.bind(null, projectId), initialState);
  const totalHours = tasks.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Project Tasks</h2>
        <p className="text-sm text-muted-foreground">{tasks.length} tasks · {totalHours} estimated hours</p>
      </div>

      <form action={formAction} encType="multipart/form-data" className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
        <Field name="title" label="Task" placeholder="Task title" />
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <StatusSelect />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assigneeId">Assign To</Label>
          <AssigneeSelect assignees={assignees} />
        </div>
        <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue="0" />
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" placeholder="Task details" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="image">Task Image</Label>
          <Input id="image" name="image" type="file" accept="image/*" />
        </div>
        <div className="flex items-center justify-between gap-3 md:col-span-2">
          <ActionMessage state={state} />
          <Button disabled={pending}>
            <Plus className="h-4 w-4" />
            {pending ? "Adding..." : "Add Task"}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 xl:grid-cols-4">
        {statusGroups.map((group) => (
          <TaskColumn key={group.value} projectId={projectId} group={group} tasks={tasks.filter((task) => task.status === group.value)} assignees={assignees} />
        ))}
      </div>
    </section>
  );
}

function TaskColumn({ projectId, group, tasks, assignees }: { projectId: string; group: { value: string; label: string }; tasks: any[]; assignees: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          {group.label}
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tasks.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length ? tasks.map((task) => <TaskItem key={task._id} projectId={projectId} task={task} assignees={assignees} />) : <p className="text-sm text-muted-foreground">No tasks</p>}
      </CardContent>
    </Card>
  );
}

function TaskItem({ projectId, task, assignees }: { projectId: string; task: any; assignees: any[] }) {
  const [state, formAction, pending] = useActionState(updateProjectTask.bind(null, task._id, projectId), initialState);
  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <form action={formAction} encType="multipart/form-data" className="space-y-3">
        <Field name="title" label="Task" defaultValue={task.title} />
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
          <Label>Description</Label>
          <Textarea name="description" defaultValue={task.description} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {task.estimatedHours ?? 0}h
          <span>·</span>
          <span>{task.assigneeId?.name ?? "Unassigned"}</span>
          <span>·</span>
          <span>Added by {task.createdBy?.name ?? "Unknown"}</span>
          {task.imageId && (
            <Link className="inline-flex items-center gap-1 text-primary hover:underline" href={`/api/receipts/${task.imageId}`} target="_blank">
              <ImageIcon className="h-3.5 w-3.5" />
              Image
            </Link>
          )}
        </div>
        <Input name="image" type="file" accept="image/*" />
        <ActionMessage state={state} />
        <Button size="sm" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
      </form>
      <form action={deleteProjectTask}>
        <input type="hidden" name="taskId" value={task._id} />
        <input type="hidden" name="projectId" value={projectId} />
        <Button type="submit" variant="ghost" size="sm" className="text-destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </form>
    </div>
  );
}

function StatusSelect({ defaultValue = "to_do" }: { defaultValue?: string }) {
  return (
    <Select name="status" defaultValue={defaultValue}>
      {statusGroups.map((status) => (
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
      <Label htmlFor={String(props.name)}>{label}</Label>
      <Input id={String(props.name)} {...props} />
    </div>
  );
}
