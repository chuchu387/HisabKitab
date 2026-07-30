"use client";

import { useActionState } from "react";
import { addLeadActivity } from "@/actions/leads";
import { ActionMessage } from "@/components/action-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadActivityTypes } from "@/constants";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };

export function ActivityForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadActivity, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:flex sm:items-end">
        <div className="space-y-2 sm:min-w-40">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue="note">
            {leadActivityTypes.filter((t) => t !== "status_changed" && t !== "converted").map((type) => (
              <option key={type} value={type}>{type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" placeholder="Call summary, meeting notes, email follow-up..." rows={2} />
        </div>
        <Button disabled={pending} className="shrink-0">{pending ? "Adding..." : "Add Activity"}</Button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
