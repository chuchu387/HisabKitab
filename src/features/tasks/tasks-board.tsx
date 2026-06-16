"use client";

import Link from "next/link";
import { Clock, ImageIcon, Plus, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { createGlobalProjectTask, deleteProjectTask, updateProjectTask } from "@/actions/project-tasks";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function TasksBoard({ tasks, projects, assignees }: { tasks: any[]; projects: any[]; assignees: any[] }) {
  const [state, formAction, pending] = useActionState(createGlobalProjectTask, initialState);
  const totalHours = tasks.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Tasks</p>
          <p className="text-2xl font-semibold">{tasks.length}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Estimated Hours</p>
          <p className="text-2xl font-semibold">{totalHours}</p>
        </div>
        {statuses.map((status) => (
          <div key={status.value}>
            <p className="text-sm text-muted-foreground">{status.label}</p>
            <p className="text-2xl font-semibold">{tasks.filter((task) => task.status === status.value).length}</p>
          </div>
        ))}
      </div>

      <form action={formAction} encType="multipart/form-data" className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
        <Field name="title" label="Task" placeholder="Task title" />
        <div className="space-y-2">
          <Label>Project</Label>
          <ProjectSelect projects={projects} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <StatusSelect />
        </div>
        <div className="space-y-2">
          <Label>Assign To</Label>
          <AssigneeSelect assignees={assignees} />
        </div>
        <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue="0" />
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea name="description" placeholder="Task details" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Task Image</Label>
          <Input name="image" type="file" accept="image/*" />
        </div>
        <div className="flex items-center justify-between md:col-span-2">
          <ActionMessage state={state} />
          <Button disabled={pending}>
            <Plus className="h-4 w-4" />
            {pending ? "Adding..." : "Add Task"}
          </Button>
        </div>
      </form>

      <div className="grid gap-4 xl:grid-cols-4">
        {statuses.map((status) => (
          <Card key={status.value}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                {status.label}
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tasks.filter((task) => task.status === status.value).length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.filter((task) => task.status === status.value).map((task) => (
                <TaskCard key={task._id} task={task} assignees={assignees} />
              ))}
              {!tasks.some((task) => task.status === status.value) && <p className="text-sm text-muted-foreground">No tasks</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, assignees }: { task: any; assignees: any[] }) {
  const projectId = task.projectId?._id ?? task.projectId;
  const [state, formAction, pending] = useActionState(updateProjectTask.bind(null, task._id, projectId), initialState);
  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <form action={formAction} encType="multipart/form-data" className="space-y-3">
        <Field name="title" label="Task" defaultValue={task.title} />
        <p className="text-xs text-muted-foreground">
          Project: <Link className="text-primary hover:underline" href={`/projects/${projectId}`}>{task.projectId?.name ?? "Project"}</Link>
        </p>
        <div className="space-y-2">
          <Label>Status</Label>
          <StatusSelect defaultValue={task.status} />
        </div>
        <div className="space-y-2">
          <Label>Assign To</Label>
          <AssigneeSelect assignees={assignees} defaultValue={task.assigneeId?._id ?? task.assigneeId ?? ""} />
        </div>
        <Field name="estimatedHours" label="Estimated Hours" type="number" min="0" step="0.25" defaultValue={task.estimatedHours ?? 0} />
        <Textarea name="description" defaultValue={task.description} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {task.estimatedHours ?? 0}h
          <span>·</span>
          <span>{task.assigneeId?.name ?? "Unassigned"}</span>
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
