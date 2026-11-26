import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Leave } from "@/models/Leave";
import { User } from "@/models/User";
import { PageShell } from "@/components/page-shell";
import { nepalDateString } from "@/lib/timezone";
import { LeaveManager } from "@/features/attendance/leave-manager";

async function getData(organizationId: string, month: string, userId: string, canManage: boolean) {
  await connectToDatabase();
  const leaveQuery = { organizationId, date: { $regex: `^${month}` }, ...(canManage ? {} : { userId }) };
  const leaves = await Leave.find(leaveQuery).populate("userId", "name role").populate("approvedBy", "name").sort({ date: -1 }).lean();
  const members = canManage ? await User.find({ organizationId, active: true }).sort({ name: 1 }).select("name _id").lean() : [];
  const pending = canManage ? await Leave.countDocuments({ organizationId, status: "pending" }) : 0;
  return { leaves: JSON.parse(JSON.stringify(leaves)), members: JSON.parse(JSON.stringify(members)), pending };
}

export default async function LeavesPage({ searchParams }: any) {
  const { session, organizationId, permissions } = await requireFeature("attendanceView");
  const params = await searchParams;
  const month = typeof params?.month === "string" ? params.month : nepalDateString().slice(0, 7);
  const isAdmin = session.user.role === "owner" || Boolean(permissions?.attendanceManage);
  const { leaves, members, pending } = await getData(organizationId, month, session.user.userId, isAdmin);
  return (
    <PageShell title="Leave Calendar" description="Request and manage time-off">
      <LeaveManager leaves={leaves} members={members} pending={pending} month={month} isAdmin={isAdmin} userId={session.user.userId!} />
    </PageShell>
  );
}
