"use client";

import { useState, type FormEvent } from "react";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loading";

const initialState = { ok: false, message: "" };

export function ForgotPasswordForm() {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(initialState);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") })
      });
      const result = await response.json().catch(() => ({ ok: false, message: "Unable to send reset link right now" }));
      setState({ ok: Boolean(result.ok), message: result.message ?? "Unable to send reset link right now" });
    } catch {
      setState({ ok: false, message: "Unable to send reset link right now" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
