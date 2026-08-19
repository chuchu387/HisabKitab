import { connectToDatabase } from "@/lib/db";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { Attendance } from "@/models/Attendance";
import { NEPAL_OFFSET_MS } from "@/lib/timezone";

export interface PunchInput {
  pin: string;
  stamp?: string | Date | null;
}

export async function findOrgByDeviceSn(deviceSn: string) {
  await connectToDatabase();
  return Organization.findOne({ attendanceMode: "device", "device.deviceSn": deviceSn }).lean();
}

export function nepalDateOf(ms: number): string {
  return new Date(ms + NEPAL_OFFSET_MS).toISOString().slice(0, 10);
}

export async function processPunch(org: any, pin: string, stamp: Date, deviceSn: string) {
  const user: any = await User.findOne({ organizationId: org._id, devicePin: String(pin).trim(), active: true }).select("_id").lean();
  if (!user) return { ok: false, reason: "unknown-pin" };
  const stampMs = stamp.getTime();
  const date = nepalDateOf(stampMs);
  await Attendance.updateMany(
    { organizationId: org._id, userId: user._id, date: { $ne: date }, checkOutTime: null },
    { $set: { checkOutTime: stamp } }
  );
  const existing: any = await Attendance.findOne({ organizationId: org._id, userId: user._id, date }).lean();
  if (existing) {
    if (!existing.checkOutTime && stampMs > new Date(existing.checkInTime).getTime()) {
      await Attendance.updateOne({ _id: existing._id }, { $set: { checkOutTime: stamp } });
      return { ok: true, action: "checkout" };
    }
    return { ok: true, action: "ignored" };
  }
  await Attendance.create({
    organizationId: org._id,
    userId: user._id,
    date,
    checkInTime: stamp,
    method: "device",
    deviceId: deviceSn,
    createdBy: user._id
  });
  return { ok: true, action: "checkin" };
}

export async function processPunches(org: any, punches: PunchInput[], deviceSn: string) {
  let checkedIn = 0;
  let checkedOut = 0;
  let ignored = 0;
  let unmatched = 0;
  for (const p of punches) {
    const stamp = p.stamp ? new Date(p.stamp) : new Date();
    if (isNaN(stamp.getTime())) continue;
    const res = await processPunch(org, p.pin, stamp, deviceSn);
    if (!res.ok && res.reason === "unknown-pin") unmatched++;
    else if (res.ok && res.action === "checkin") checkedIn++;
    else if (res.ok && res.action === "checkout") checkedOut++;
    else ignored++;
  }
  return { checkedIn, checkedOut, ignored, unmatched };
}