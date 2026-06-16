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

const initialState = { ok: false, message: "" };

export function ProjectForm({ project }: { project?: any }) {
  const action = project ? updateProject.bind(null, project._id.toString()) : createProject;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue={project?.name} />
      <Field name="code" label="Code" defaultValue={project?.code} />
      <Field name="totalBudget" label="Budget" type="number" min="0" step="0.01" defaultValue={project?.totalBudget} />
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={project?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </Select>
      </div>
      <Field name="startDate" label="Start Date" type="date" defaultValue={formatDate(project?.startDate)} />
      <Field name="endDate" label="End Date" type="date" defaultValue={formatDate(project?.endDate)} />
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

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
