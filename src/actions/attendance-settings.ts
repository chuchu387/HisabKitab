"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { AttendanceSetting } from "@/models/AttendanceSetting";
import { actionError } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import type { ActionState } from "@/types";

const attendanceSettingSchema = z.object({
  officeStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  officeEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  graceMinutes: z.coerce.number().min(0).max(240),
  absentIfLateMinutes: z.coerce.number().min(0).max(600),
  halfDayAfterMinutes: z.coerce.number().min(0).max(720),
  reminderStartHour: z.coerce.number().min(0).max(23),
  reminderEndHour: z.coerce.number().min(0).max(23),
  reminderMaxPerDay: z.coerce.number().min(0).max(24),
  remindersEnabled: z.coerce.boolean().default(false),
  holidays: z.string().optional().default("")
});

export async function saveAttendanceSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, organizationId } = await requireFeature("attendanceManage");
    await connectToDatabase();
    const parsed = attendanceSettingSchema.parse(Object.fromEntries(formData.entries()));
    const workingDays = formData.getAll("workingDays").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    if (!workingDays.length) throw new Error("Select at least one working day");
    const holidays = parsed.holidays.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    const settings = await AttendanceSetting.findOneAndUpdate(
      { organizationId },
      {
        ...parsed,
        remindersEnabled: formData.get("remindersEnabled") === "on",
        workingDays: Array.from(new Set(workingDays)).sort(),
        holidays
      },
      { upsert: true, new: true, runValidators: true }
    );
    await writeAuditLog({
      organizationId,
      userId: session.user.userId,
      action: "Attendance Settings Updated",
      entityType: "AttendanceSetting",
      entityId: settings._id.toString(),
      metadata: { workingDays, reminderStartHour: parsed.reminderStartHour, reminderEndHour: parsed.reminderEndHour, reminderMaxPerDay: parsed.reminderMaxPerDay }
    });
    revalidatePath("/attendance/settings");
    return { ok: true, message: "Attendance settings saved" };
  } catch (error) {
    return actionError(error);
  }
}
