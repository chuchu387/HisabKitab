"use client";

import { useActionState } from "react";
import { updateLeadFollowUp } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function FollowUpForm({ leadId }: { leadId: string }) {
  const action = updateLeadFollowUp.bind(null, leadId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="followUpDate">Follow-up Date</Label>
        <Input id="followUpDate" name="followUpDate" type="date" />
      </div>
      <Button disabled={pending}>{pending ? "Saving..." : "Update"}</Button>
      <ActionMessage state={state} />
    </form>
  );
}
