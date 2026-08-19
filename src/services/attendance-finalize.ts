import { Attendance } from "@/models/Attendance";
import { nepalDateString } from "@/lib/timezone";

export function officeEndMsForDate(date: string, officeEnd: string): number {
  return new Date(`${date}T${officeEnd}:00+05:45`).getTime();
}

export async function finalizeOpenAttendance(organizationId: string, settings?: { officeEndTime?: string }): Promise<number> {
  const end = settings?.officeEndTime ?? "18:00";
  const open: any[] = await Attendance.find({ organizationId, checkOutTime: null }).select("_id date").lean();
  if (!open.length) return 0;
  const now = Date.now();
  const writes: any[] = [];
  for (const record of open) {
    const endMs = officeEndMsForDate(record.date, end);
    if (now >= endMs) {
      writes.push({
        updateOne: { filter: { _id: record._id, checkOutTime: null }, update: { $set: { checkOutTime: new Date(endMs) } } }
      });
    }
  }
  if (writes.length) await Attendance.bulkWrite(writes);
  return writes.length;
}