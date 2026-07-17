"use client";

import { useActionState } from "react";
import { createProject, updateProject } from "@/actions/projects";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function ProjectForm({ project }: { project?: any }) {
  const action = project ? updateProject.bind(null, project._id.toString()) : createProject;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-5 shadow-sm shadow-foreground/5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue={project?.name} error={state.fieldErrors?.name?.[0]} />
      <Field name="code" label="Code" defaultValue={project?.code} error={state.fieldErrors?.code?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="projectType">Project Type</Label>
        <Select id="projectType" name="projectType" defaultValue={project?.projectType ?? "client"}>
          <option value="client">Client Project</option>
          <option value="internal">Internal Project</option>
        </Select>
        {state.fieldErrors?.projectType?.[0] && <p className="text-xs text-destructive">{state.fieldErrors.projectType[0]}</p>}
      </div>
      <Field name="totalBudget" label="Total Budget" type="number" min="0" step="0.01" defaultValue={project?.totalBudget ?? 0} error={state.fieldErrors?.totalBudget?.[0]} />
      <Field name="receivedAmount" label="Total Received Till Now" type="number" min="0" step="0.01" defaultValue={project?.receivedAmount ?? 0} error={state.fieldErrors?.receivedAmount?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={project?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </Select>
      </div>
      <Field name="startDate" label="Start Date" type="date" defaultValue={formatDate(project?.startDate)} error={state.fieldErrors?.startDate?.[0]} />
      <Field name="endDate" label="End Date" type="date" defaultValue={formatDate(project?.endDate)} error={state.fieldErrors?.endDate?.[0]} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={project?.description} />
      </div>
      <div className="flex items-end justify-between gap-3 md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Project"}</Button>
      </div>
    </form>
  );
}

function Field({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={String(props.name)}>{label}</Label>
      <Input id={String(props.name)} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
