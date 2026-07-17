"use client";

import { useActionState } from "react";
import { createUser, updateUser } from "@/actions/users";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { roleLabels } from "@/constants";

const initialState = { ok: false, message: "" };

export function UserForm({ user }: { user?: any }) {
  const action = user ? updateUser.bind(null, user._id.toString()) : createUser;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 sm:p-5 shadow-sm shadow-foreground/5 md:grid-cols-2">
      <Field name="name" label="Name" defaultValue={user?.name} />
      <Field name="email" label="Email" type="email" defaultValue={user?.email} />
      <Field name="password" label={user ? "New Password" : "Password"} type="password" required={!user} />
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue={user?.role ?? "staff"}>
          {(["owner", "admin", "staff"] as const).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" value="true" defaultChecked={user?.active ?? true} /> Active</label>
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between md:col-span-2">
        <ActionMessage state={state} />
        <Button disabled={pending}>{pending ? "Saving..." : "Save User"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <div className="space-y-2"><Label htmlFor={String(props.name)}>{label}</Label><Input id={String(props.name)} {...props} /></div>;
}
