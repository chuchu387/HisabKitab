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
      <div className="space-y-3 rounded-lg border bg-background p-3 md:col-span-2">
        <div>
          <p className="text-sm font-semibold">Task Access</p>
          <p className="text-xs text-muted-foreground">Control what this user can do in task folders and project task boards.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Permission name="canCreateTask" label="Create tasks" defaultChecked={taskPermission(user, "canCreateTask", true)} />
          <Permission name="canAssignTask" label="Assign tasks to staff/admin" defaultChecked={taskPermission(user, "canAssignTask", user?.role === "admin" || user?.role === "owner")} />
          <Permission name="canCreateFolder" label="Create task folders" defaultChecked={taskPermission(user, "canCreateFolder", user?.role === "admin" || user?.role === "owner")} />
          <Permission name="canManageFolderProjects" label="Add projects to folders" defaultChecked={taskPermission(user, "canManageFolderProjects", user?.role === "admin" || user?.role === "owner")} />
        </div>
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

function Permission({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-input accent-primary" />
      {label}
    </label>
  );
}

function taskPermission(user: any, key: string, fallback: boolean) {
  if (!user) return fallback;
  if (!user.taskPermissions) return fallback;
  return Boolean(user.taskPermissions[key]);
}
