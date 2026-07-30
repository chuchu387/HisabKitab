import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { Notification } from "@/models/Notification";
import { Attendance } from "@/models/Attendance";
import { CheckInGuard } from "@/features/attendance/checkin-guard";
import { nepalDateString, isCheckInOpen } from "@/lib/timezone";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await connectToDatabase();
  const [notifications, unreadCount] = session.user.organizationId ? await Promise.all([
    Notification.find({ organizationId: session.user.organizationId, userId: session.user.userId }).sort({ createdAt: -1 }).limit(10).lean(),
    Notification.countDocuments({ organizationId: session.user.organizationId, userId: session.user.userId, readAt: null })
  ]) : [[], 0];
  const today = nepalDateString();
  const withinWindow = isCheckInOpen();
  const attendanceRecord: any = session.user.organizationId
    ? await Attendance.findOne({ organizationId: session.user.organizationId, userId: session.user.userId, date: today }).lean()
    : null;
  const alreadyMarked = !!attendanceRecord;
  const checkedOut = alreadyMarked && !!attendanceRecord.checkOutTime;
  const checkInTime = alreadyMarked ? new Date(attendanceRecord.checkInTime).toISOString() : null;
  return (
    <div className="flex h-dvh overflow-hidden bg-background/80">
      <Sidebar role={session.user.role} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header name={session.user.name ?? ""} email={session.user.email ?? ""} role={session.user.role} notifications={JSON.parse(JSON.stringify(notifications))} unreadCount={unreadCount} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-6">
          <CheckInGuard alreadyMarked={alreadyMarked} checkedOut={checkedOut} withinWindow={withinWindow} checkInTime={checkInTime}>
            {children}
          </CheckInGuard>
        </main>
      </div>
    </div>
  );
}
