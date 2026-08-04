"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Attendance } from "@/models/Attendance";
import { Leave } from "@/models/Leave";
import { User } from "@/models/User";
import { getReceiptBucket } from "@/services/gridfs";
import { writeAuditLog } from "@/services/audit";
import { nepalDateString, isCheckInOpen } from "@/lib/timezone";

export async function markAttendance(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (session.user.role === "super_admin") return { ok: true, message: "Attendance is not tracked for Super Admin" };
    await connectToDatabase();
    if (!isCheckInOpen()) return { ok: false, message: "Check-in is only available between 8AM and midnight (Nepal time)." };
    const today = nepalDateString();
    const existing = await Attendance.findOne({ organizationId, userId: session.user.userId, date: today });
    if (existing) return { ok: false, message: "Attendance already marked today" };
    const selfieFile = formData.get("selfie") as File | null;
    let selfieId: string | null = null;
    if (selfieFile && selfieFile.size > 0) {
      if (selfieFile.size > 5 * 1024 * 1024) return { ok: false, message: "Selfie must be 5MB or smaller" };
      if (!selfieFile.type.startsWith("image/")) return { ok: false, message: "Selfie must be an image" };
      const bucket = await getReceiptBucket();
      const buffer = Buffer.from(await selfieFile.arrayBuffer());
      const upload = bucket.openUploadStream(`attendance-${today}-${session.user.userId}.jpg`, {
        contentType: selfieFile.type,
        metadata: { organizationId, userId: session.user.userId, date: today, type: "attendance" }
      });
      await new Promise<void>((resolve, reject) => {
        upload.end(buffer, (error?: Error) => (error ? reject(error) : resolve()));
      });
      selfieId = upload.id.toString();
    }
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? "";
    await Attendance.updateMany(
      { organizationId, userId: session.user.userId, date: { $ne: today }, checkOutTime: null },
      { $set: { checkOutTime: new Date(Date.now() - 60 * 1000) } }
    );
    const created = await Attendance.create({
      organizationId,
      userId: session.user.userId,
      date: today,
      checkInTime: new Date(),
      selfieId,
      ipAddress: ip,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Attendance Marked", entityType: "Attendance", entityId: created._id.toString(), metadata: { date: today, hasSelfie: !!selfieId } });
    revalidatePath("/");
    revalidatePath("/attendance");
    return { ok: true, message: "Attendance marked successfully" };
  } catch (error) {
    if (error instanceof Error && (error as Error & { digest?: string }).digest === "NEXT_REDIRECT") throw error;
    return { ok: false, message: error instanceof Error ? error.message : "Failed to mark attendance" };
  }
}

const MIN_WORK_MS = 3 * 60 * 60 * 1000;

export async function checkOutAttendance(): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (session.user.role === "super_admin") return { ok: true, message: "Attendance is not tracked for Super Admin" };
    await connectToDatabase();
    const today = nepalDateString();
    const record = await Attendance.findOne({ organizationId, userId: session.user.userId, date: today });
    if (!record) return { ok: false, message: "No check-in found for today" };
    if (record.checkOutTime) return { ok: false, message: "Already checked out today" };
    const elapsed = Date.now() - new Date(record.checkInTime).getTime();
    if (elapsed < MIN_WORK_MS) {
      const remaining = Math.ceil((MIN_WORK_MS - elapsed) / 60000);
      return { ok: false, message: `Must work at least 3 hours. You can check out in ${remaining} minutes.` };
    }
    record.checkOutTime = new Date();
    await record.save();
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Attendance Checked Out", entityType: "Attendance", entityId: record._id.toString(), metadata: { date: today } });
    revalidatePath("/");
    revalidatePath("/attendance");
    return { ok: true, message: "Checked out successfully" };
  } catch (error) {
    if (error instanceof Error && (error as Error & { digest?: string }).digest === "NEXT_REDIRECT") throw error;
    return { ok: false, message: error instanceof Error ? error.message : "Failed to check out" };
  }
}

export async function adminMarkAttendance(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (!["owner", "admin"].includes(session.user.role)) return { ok: false, message: "Not authorized" };
    await connectToDatabase();
    const targetUserId = formData.get("userId") as string;
    const date = formData.get("date") as string;
    const checkInStr = formData.get("checkInTime") as string;
    const checkOutStr = formData.get("checkOutTime") as string;
    const note = formData.get("note") as string;
    if (!targetUserId || !date || !checkInStr) return { ok: false, message: "userId, date, and checkInTime are required" };
    const existing = await Attendance.findOne({ organizationId, userId: targetUserId, date });
    if (existing) return { ok: false, message: "Attendance already exists for this user on this date" };
    await Attendance.updateMany(
      { organizationId, userId: targetUserId, date: { $ne: date }, checkOutTime: null },
      { $set: { checkOutTime: new Date(checkInStr) } }
    );
    const created = await Attendance.create({
      organizationId,
      userId: targetUserId,
      date,
      checkInTime: new Date(checkInStr),
      checkOutTime: checkOutStr ? new Date(checkOutStr) : null,
      note,
      createdBy: session.user.userId
    });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Attendance Admin Marked", entityType: "Attendance", entityId: created._id.toString(), metadata: { targetUserId, date } });
    revalidatePath("/attendance");
    return { ok: true, message: "Attendance marked for user" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to mark attendance" };
  }
}

export async function getAttendanceReport(organizationId: string, month: string) {
  await connectToDatabase();
  const superAdmins = await User.find({ organizationId, role: "super_admin" }).select("_id").lean();
  const excluded = superAdmins.map((u: any) => u._id);
  const users = await User.find({ organizationId, active: true, role: { $ne: "super_admin" } }).sort({ name: 1 }).select("name _id role").lean();
  const records = await Attendance.find({ organizationId, userId: { $nin: excluded }, date: { $regex: `^${month}` } }).sort({ date: -1 }).lean();
  const leaves = await Leave.find({ organizationId, date: { $regex: `^${month}` }, status: "approved" }).lean();
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = nepalDateString();
  const totalDays = month === today.slice(0, 7) ? Math.min(daysInMonth, parseInt(today.slice(8))) : daysInMonth;
  return JSON.parse(JSON.stringify({ users, records, leaves, totalDays }));
}

export async function getTodayAttendance(organizationId: string, userId: string) {
  await connectToDatabase();
  const today = nepalDateString();
  return Attendance.findOne({ organizationId, userId, date: today }).lean();
}
