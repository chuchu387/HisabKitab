"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { changePassword } from "@/actions/auth";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loading";

const initialState = { ok: false, message: "" };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border bg-card/95 p-4 shadow-sm sm:p-5">
      <PasswordField id="currentPassword" name="currentPassword" label="Current Password" autoComplete="current-password" showPassword={showPassword} onToggle={() => setShowPassword((value) => !value)} />
      <PasswordField id="newPassword" name="newPassword" label="New Password" autoComplete="new-password" showPassword={showPassword} onToggle={() => setShowPassword((value) => !value)} />
      <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm New Password" autoComplete="new-password" showPassword={showPassword} onToggle={() => setShowPassword((value) => !value)} />
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <Button disabled={pending}>
          {pending && <Spinner className="h-4 w-4" />}
          {pending ? "Changing..." : "Change Password"}
        </Button>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  showPassword,
  onToggle
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} name={name} type={showPassword ? "text" : "password"} autoComplete={autoComplete} minLength={8} required className="pr-11" />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onToggle}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
