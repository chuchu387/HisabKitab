"use client";

import { useActionState } from "react";
import { createCategory, updateCategory } from "@/actions/categories";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = { ok: false, message: "" };

export function CategoryForm({ category }: { category?: any }) {
  const action = category ? updateCategory.bind(null, category._id.toString()) : createCategory;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card p-5">
      <Field name="name" label="Name" defaultValue={category?.name} />
      <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" defaultValue={category?.description} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" value="true" defaultChecked={category?.active ?? true} /> Active</label>
      <div className="flex items-end justify-between gap-3">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save Category"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
