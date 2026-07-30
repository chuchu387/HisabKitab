"use client";

import { useActionState } from "react";
import { createLeadTask, updateLeadTask } from "@/actions/lead-tasks";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadTaskStatuses } from "@/constants";
import { formatDate } from "@/lib/utils";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function LeadTaskForm({ task, leads = [], users = [] }: { task?: any; leads?: any[]; users?: any[] }) {
  const action = task ? updateLeadTask.bind(null, task._id.toString()) : createLeadTask;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 shadow-sm shadow-foreground/5 sm:p-5 md:grid-cols-2">
      <Field name="title" label="Task Title" defaultValue={task?.title} error={state.fieldErrors?.title?.[0]} />
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={task?.status ?? "to_contact"}>
          {leadTaskStatuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadId">Related Lead</Label>
        <Select id="leadId" name="leadId" defaultValue={task?.leadId ?? ""}>
          <option value="">No lead</option>
          {leads.map((lead) => <option key={lead._id} value={lead._id}>{lead.name}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assigneeId">Assignee</Label>
        <Select id="assigneeId" name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
          <option value="">Unassigned</option>
          {users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
        </Select>
      </div>
      <Field name="dueDate" label="Due Date" type="date" defaultValue={formatDate(task?.dueDate)} error={state.fieldErrors?.dueDate?.[0]} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={task?.description} />
      </div>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : task ? "Update Task" : "Create Task"}</Button>
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
