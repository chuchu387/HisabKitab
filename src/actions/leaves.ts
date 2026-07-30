"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Leave } from "@/models/Leave";

export async function requestLeave(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const date = formData.get("date") as string;
    const reason = formData.get("reason") as string;
    if (!date) return { ok: false, message: "Date is required" };
    const existing = await Leave.findOne({ organizationId, userId: session.user.userId, date });
    if (existing) return { ok: false, message: "Leave already exists for this date" };
    await Leave.create({ organizationId, userId: session.user.userId, date, reason, createdBy: session.user.userId });
    revalidatePath("/attendance/leaves");
    return { ok: true, message: "Leave requested" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to request leave" };
  }
}

export async function approveLeave(id: string, status: "approved" | "rejected"): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (!["owner", "admin"].includes(session.user.role)) return { ok: false, message: "Not authorized" };
    await connectToDatabase();
    await Leave.findOneAndUpdate({ _id: id, organizationId }, { status, approvedBy: session.user.userId });
    revalidatePath("/attendance/leaves");
    return { ok: true, message: `Leave ${status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Failed to update leave" };
  }
}

export async function getLeaves(organizationId: string, month: string) {
  await connectToDatabase();
  const leaves = await Leave.find({ organizationId, date: { $regex: `^${month}` } }).populate("userId", "name role").populate("approvedBy", "name").sort({ date: -1 }).lean();
  return JSON.parse(JSON.stringify(leaves));
}
