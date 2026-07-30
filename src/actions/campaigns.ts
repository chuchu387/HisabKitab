"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Campaign } from "@/models/Campaign";
import { Lead } from "@/models/Lead";

export async function saveCampaign(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const id = formData.get("id") as string;
    const data: any = { name: formData.get("name"), organizationId, createdBy: session.user.userId };
    if (formData.get("source")) data.source = formData.get("source");
    if (formData.get("description")) data.description = formData.get("description");
    if (formData.get("budget")) data.budget = parseFloat(formData.get("budget") as string);
    if (id) {
      await Campaign.findOneAndUpdate({ _id: id, organizationId }, data);
    } else {
      await Campaign.create(data);
    }
    revalidatePath("/sales/campaigns");
    return { ok: true, message: id ? "Campaign updated" : "Campaign created" };
  } catch (error: any) {
    return { ok: false, message: error.code === 11000 ? "Campaign name already exists" : "Failed to save campaign" };
  }
}

export async function getCampaignStats(organizationId: string) {
  await connectToDatabase();
  const campaigns = await Campaign.find({ organizationId, active: true }).sort({ name: 1 }).lean() as any[];
  const stats = await Promise.all(campaigns.map(async (c) => {
    const leads = await Lead.find({ organizationId, campaignId: c._id }).lean() as any[];
    const won = leads.filter((l) => l.status === "won");
    return {
      ...c,
      totalLeads: leads.length,
      wonLeads: won.length,
      totalValue: won.reduce((s, l) => s + (l.dealValue || 0), 0),
      conversionRate: leads.length ? Math.round((won.length / leads.length) * 100) : 0
    };
  }));
  return JSON.parse(JSON.stringify(stats));
}
