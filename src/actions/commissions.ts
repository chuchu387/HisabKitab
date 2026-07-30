"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Commission } from "@/models/Commission";
import { Lead } from "@/models/Lead";
import { SalesTarget } from "@/models/SalesTarget";
import { User } from "@/models/User";

export async function calculateCommission(leadId: string) {
  const { session, organizationId } = await requireTenant();
  if (!["owner", "admin"].includes(session.user.role)) return;
  await connectToDatabase();
  const lead = await Lead.findOne({ _id: leadId, organizationId }).lean() as any;
  if (!lead || lead.status !== "won" || !lead.dealValue) return;
  const existing = await Commission.findOne({ organizationId, leadId });
  if (existing) return;
  const target = await SalesTarget.findOne({ organizationId, userId: lead.assignedTo, month: new Date().toISOString().slice(0, 7) }).lean() as any;
  let commissionAmount = 0;
  if (target) {
    commissionAmount = (lead.dealValue * target.commissionRate) / 100 + target.commissionFixed;
  }
  if (commissionAmount > 0) {
    await Commission.create({ organizationId, userId: lead.assignedTo, leadId, dealValue: lead.dealValue, commissionAmount, createdBy: session.user.userId });
    revalidatePath("/sales/commissions");
  }
}

export async function payCommission(id: string): Promise<{ ok: boolean }> {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  await Commission.findOneAndUpdate({ _id: id, organizationId }, { status: "paid", paidAt: new Date() });
  revalidatePath("/sales/commissions");
  return { ok: true };
}

export async function saveSalesTarget(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    if (!["owner", "admin"].includes(session.user.role)) return { ok: false, message: "Not authorized" };
    await connectToDatabase();
    const id = formData.get("id") as string;
    const data: any = {
      userId: formData.get("userId"),
      month: formData.get("month"),
      targetAmount: parseFloat(formData.get("targetAmount") as string) || 0,
      commissionRate: parseFloat(formData.get("commissionRate") as string) || 0,
      commissionFixed: parseFloat(formData.get("commissionFixed") as string) || 0,
      organizationId,
      createdBy: session.user.userId
    };
    if (id) {
      await SalesTarget.findOneAndUpdate({ _id: id, organizationId }, data);
    } else {
      await SalesTarget.create(data);
    }
    revalidatePath("/sales/targets");
    return { ok: true, message: id ? "Target updated" : "Target created" };
  } catch (error: any) {
    return { ok: false, message: error.code === 11000 ? "Target already exists for this user/month" : "Failed to save target" };
  }
}

export async function getSalesData(organizationId: string, month: string) {
  await connectToDatabase();
  const users = await User.find({ organizationId, active: true }).sort({ name: 1 }).select("name _id").lean();
  const targets = await SalesTarget.find({ organizationId, month }).lean() as any[];
  const commissions = await Commission.find({ organizationId }).populate("leadId", "name").lean() as any[];
  const wonLeads = await Lead.find({ organizationId, status: "won" }).lean() as any[];
  return {
    users: JSON.parse(JSON.stringify(users)),
    targets: JSON.parse(JSON.stringify(targets)),
    commissions: JSON.parse(JSON.stringify(commissions)),
    wonLeads: JSON.parse(JSON.stringify(wonLeads))
  };
}
