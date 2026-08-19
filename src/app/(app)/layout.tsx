import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { User } from "@/models/User";
import { resolvePermissions, type Permissions } from "@/constants/permissions";
import { Notification } from "@/models/Notification";
import { Attendance } from "@/models/Attendance";
import { Organization } from "@/models/Organization";
import { CheckInGuard } from "@/features/attendance/checkin-guard";
import { PushManager } from "@/components/push-manager";
import { CallProvider } from "@/components/call-provider";
import { nepalDateString, isCheckInOpen, NEPAL_OFFSET_MS } from "@/lib/timezone";
import { AttendanceSetting } from "@/models/AttendanceSetting";
import { finalizeOpenAttendance } from "@/services/attendance-finalize";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await connectToDatabase();
  const [notifications, unreadCount] = session.user.organizationId ? await Promise.all([
    Notification.find({ organizationId: session.user.organizationId, userId: session.user.userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Notification.countDocuments({ organizationId: session.user.organizationId, userId: session.user.userId, readAt: null })
  ]) : [[], 0];
  let permissions: Permissions | null = null;
  if (session.user.organizationId && session.user.role !== "owner") {
    const user = await User.findById(session.user.userId).select("role permissions").lean() as any;
    if (user) permissions = resolvePermissions(user.role, user.permissions || {});
  }
  const today = nepalDateString();
  const settings: any = session.user.organizationId ? await AttendanceSetting.findOne({ organizationId: session.user.organizationId }).lean() : null;
  const withinWindow = isCheckInOpen(settings);
  const todayDay = new Date(Date.now() + NEPAL_OFFSET_MS).getUTCDay();
  const workingDays = settings?.workingDays?.length ? settings.workingDays.map(Number) : [0, 1, 2, 3, 4, 5];
  const holidayToday = !!settings?.holidays?.includes(today);
  const nonWorkingToday = holidayToday || !workingDays.includes(todayDay);
  let deviceMode = false;
  if (session.user.organizationId) {
    const org: any = await Organization.findById(session.user.organizationId).select("attendanceMode").lean();
    deviceMode = org?.attendanceMode === "device";
  }
  if (session.user.organizationId) {
    await finalizeOpenAttendance(session.user.organizationId, settings);
  }
  const attendanceRecord: any = session.user.organizationId
    ? await Attendance.findOne({ organizationId: session.user.organizationId, userId: session.user.userId, date: today }).lean()
    : null;
  const alreadyMarked = !!attendanceRecord;
  const checkedOut = alreadyMarked && !!attendanceRecord.checkOutTime;
  const checkInTime = alreadyMarked ? new Date(attendanceRecord.checkInTime).toISOString() : null;
  return (
    <div className="flex h-dvh overflow-hidden bg-background/80">
      <CallProvider userId={session.user.userId} userName={session.user.name ?? ""}>
        <Sidebar role={session.user.role} permissions={permissions} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Header name={session.user.name ?? ""} email={session.user.email ?? ""} role={session.user.role} permissions={permissions} notifications={JSON.parse(JSON.stringify(notifications))} unreadCount={unreadCount} />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-6">
            <CheckInGuard alreadyMarked={alreadyMarked} checkedOut={checkedOut} withinWindow={withinWindow} checkInTime={checkInTime} officeStartTime={settings?.officeStartTime ?? "08:00"} minWorkMinutes={settings?.minWorkMinutes ?? 180} skip={nonWorkingToday || deviceMode || ["super_admin", "owner"].includes(session.user.role)}>
              {children}
            </CheckInGuard>
          </main>
        </div>
      </CallProvider>
      <PushManager />
    </div>
  );
}
