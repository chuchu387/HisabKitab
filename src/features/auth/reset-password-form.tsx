"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { resetPassword } from "@/actions/auth";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loading";

const initialState = { ok: false, message: "" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        id="password"
        label="New password"
        name="password"
        autoComplete="new-password"
        showPassword={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        showPassword={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />
      <ActionMessage state={state} />
      <Button className="w-full" disabled={pending || !token}>
        {pending && <Spinner className="h-4 w-4" />}
        {pending ? "Resetting..." : "Reset password"}
      </Button>
      {state.ok && (
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to login</Link>
        </Button>
      )}
    </form>
  );
}

function PasswordField({
  id,
  label,
  name,
  autoComplete,
  showPassword,
  onToggle
}: {
  id: string;
  label: string;
  name: string;
  autoComplete: string;
  showPassword: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} name={name} type={showPassword ? "text" : "password"} autoComplete={autoComplete} required minLength={8} className="pr-11" />
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
