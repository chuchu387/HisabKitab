"use client";

import { useActionState } from "react";
import { runPaymentDueReminders } from "@/actions/payment-reminders";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loading";

const initialState = { ok: false, message: "" };

export function ReminderRunForm() {
  const [state, formAction, pending] = useActionState(runPaymentDueReminders, initialState);
  return (
    <form action={formAction} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <input id="force" name="force" type="checkbox" className="h-4 w-4 rounded border accent-[hsl(var(--primary))]" />
        <Label htmlFor="force">Force resend even if a reminder was sent in the last 24 hours</Label>
      </div>
      <ActionMessage state={state} />
      <Button disabled={pending}>
        {pending && <Spinner className="h-4 w-4" />}
        {pending ? "Sending reminders..." : "Send Due Reminders"}
      </Button>
    </form>
  );
}
