"use client";

import { useActionState } from "react";
import { createProjectPayment } from "@/actions/project-payments";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function ProjectPaymentForm({ projects }: { projects: any[] }) {
  const [state, formAction, pending] = useActionState(createProjectPayment, initialState);
  return (
    <form action={formAction} encType="multipart/form-data" className="grid gap-4 rounded-lg border bg-card/95 p-4 sm:p-5 shadow-sm shadow-foreground/5 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Project</Label>
        <Select name="projectId" required defaultValue="">
          <option value="" disabled>Select project</option>
          {projects.map((project) => <option key={project._id} value={project._id}>{project.name} ({project.code})</option>)}
        </Select>
      </div>
      <Field name="paymentDate" label="Payment Date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      <Field name="amount" label="Amount" type="number" min="0.01" step="0.01" />
      <div className="space-y-2">
        <Label>Receipt Image</Label>
        <Input name="receipt" type="file" accept="image/*" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Note</Label>
        <Textarea name="note" />
      </div>
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Add Payment"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input {...props} /></div>;
}
