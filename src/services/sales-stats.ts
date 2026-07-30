import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Lead } from "@/models/Lead";
import { LeadTask } from "@/models/LeadTask";

export async function getSalesStats(organizationId: string) {
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [totalLeads, newThisWeek, wonThisWeek, followUpsToday, pendingTasks, pipelineValue] = await Promise.all([
    Lead.countDocuments({ organizationId: oid }),
    Lead.countDocuments({ organizationId: oid, createdAt: { $gte: weekAgo } }),
    Lead.countDocuments({ organizationId: oid, status: "won", updatedAt: { $gte: weekAgo } }),
    Lead.countDocuments({ organizationId: oid, followUpDate: { $gte: today, $lt: tomorrow } }),
    LeadTask.countDocuments({ organizationId: oid, status: { $ne: "completed" } }),
    Lead.aggregate([
      { $match: { organizationId: oid, status: { $nin: ["won", "lost"] } } },
      { $group: { _id: null, total: { $sum: "$estimatedValue" } } }
    ])
  ]);
  return {
    totalLeads,
    newThisWeek,
    wonThisWeek,
    followUpsToday,
    pendingTasks,
    pipelineValue: (pipelineValue[0] as any)?.total ?? 0
  };
}
