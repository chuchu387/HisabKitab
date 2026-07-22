"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loading";

const initialState = { ok: false, message: "" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <ActionMessage state={state} />
      <Button className="w-full" disabled={pending}>
        {pending && <Spinner className="h-4 w-4" />}
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
