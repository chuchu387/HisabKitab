"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveAttendanceSettings } from "@/actions/attendance-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/types";

const initialState: ActionState = { ok: false, message: "" };
const days = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
];

export function AttendanceSettingsForm({ settings }: { settings: any }) {
  const [state, formAction, pending] = useActionState(saveAttendanceSettings, initialState);
  const selectedDays = new Set((settings?.workingDays?.length ? settings.workingDays : [0, 1, 2, 3, 4, 5]).map(Number));
  useEffect(() => {
    if (state.message) toast[state.ok ? "success" : "error"](state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Office Start" name="officeStartTime" type="time" defaultValue={settings?.officeStartTime ?? "10:00"} />
        <Field label="Office End" name="officeEndTime" type="time" defaultValue={settings?.officeEndTime ?? "18:00"} />
        <Field label="Grace Minutes" name="graceMinutes" type="number" min="0" defaultValue={settings?.graceMinutes ?? 15} />
        <Field label="Half Day After Minutes" name="halfDayAfterMinutes" type="number" min="0" defaultValue={settings?.halfDayAfterMinutes ?? 240} />
        <Field label="Reminder Start Hour" name="reminderStartHour" type="number" min="0" max="23" defaultValue={settings?.reminderStartHour ?? 10} />
        <Field label="Reminder End Hour" name="reminderEndHour" type="number" min="0" max="23" defaultValue={settings?.reminderEndHour ?? 17} />
        <Field label="Max Reminders Per Day" name="reminderMaxPerDay" type="number" min="0" max="24" defaultValue={settings?.reminderMaxPerDay ?? 8} />
        <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
          <input name="remindersEnabled" type="checkbox" defaultChecked={settings?.remindersEnabled ?? true} className="h-4 w-4 rounded border-input accent-primary" />
          Enable missing-attendance emails
        </label>
      </div>

      <div className="space-y-2">
        <Label>Working Days</Label>
        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <label key={day.value} className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <input name="workingDays" type="checkbox" value={day.value} defaultChecked={selectedDays.has(day.value)} className="h-4 w-4 rounded border-input accent-primary" />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="holidays">Holidays</Label>
        <textarea id="holidays" name="holidays" className="native-control min-h-28" defaultValue={(settings?.holidays ?? []).join("\n")} placeholder="YYYY-MM-DD, one per line or comma-separated" />
      </div>

      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Saving..." : "Save Settings"}</Button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={String(props.name)}>{label}</Label>
      <Input id={String(props.name)} {...props} />
    </div>
  );
}
