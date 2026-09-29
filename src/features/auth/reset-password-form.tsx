"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loading";

const initialState = { ok: false, message: "" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: formData.get("token"),
          password: formData.get("password"),
          confirmPassword: formData.get("confirmPassword")
        })
      });
      const result = await response.json().catch(() => ({ ok: false, message: "Unable to reset password right now" }));
      setState({ ok: Boolean(result.ok), message: result.message ?? "Unable to reset password right now" });
    } catch {
      setState({ ok: false, message: "Unable to reset password right now" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
