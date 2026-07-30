import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { Leave } from "@/models/Leave";
import { User } from "@/models/User";
import { PageShell } from "@/components/page-shell";
import { nepalDateString } from "@/lib/timezone";
import { LeaveManager } from "@/features/attendance/leave-manager";

async function getData(organizationId: string, month: string) {
  await connectToDatabase();
  const leaves = await Leave.find({ organizationId, date: { $regex: `^${month}` } }).populate("userId", "name role").populate("approvedBy", "name").sort({ date: -1 }).lean();
  const members = await User.find({ organizationId, active: true }).sort({ name: 1 }).select("name _id").lean();
  const pending = await Leave.countDocuments({ organizationId, status: "pending" });
  return { leaves: JSON.parse(JSON.stringify(leaves)), members: JSON.parse(JSON.stringify(members)), pending };
}

export default async function LeavesPage({ searchParams }: any) {
  const session = await requireSession();
  const params = await searchParams;
  const month = typeof params?.month === "string" ? params.month : nepalDateString().slice(0, 7);
  const isAdmin = ["owner", "admin"].includes(session.user.role);
  const { leaves, members, pending } = await getData(session.user.organizationId!, month);
  return (
    <PageShell title="Leave Calendar" description="Request and manage time-off">
      <LeaveManager leaves={leaves} members={members} pending={pending} month={month} isAdmin={isAdmin} userId={session.user.userId!} />
    </PageShell>
  );
}
