import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceHistory } from "@/features/attendance/attendance-history";
import { AttendanceCalendar } from "@/features/attendance/attendance-calendar";
import { AttendanceTeam } from "@/features/attendance/attendance-team";

async function getAttendanceRecords(organizationId: string, userId: string) {
  await connectToDatabase();
  const records = await Attendance.find({ organizationId, userId }).sort({ date: -1 }).lean();
  return JSON.parse(JSON.stringify(records));
}

export default async function AttendancePage() {
  const session = await requireSession();
  const records = await getAttendanceRecords(session.user.organizationId!, session.user.userId!);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthCount = records.filter((r: any) => r.date.startsWith(currentMonth)).length;
  const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const isAdmin = ["owner", "admin"].includes(session.user.role);
  const teamToday = isAdmin
    ? await Attendance.find({ organizationId: session.user.organizationId, date: new Date().toISOString().slice(0, 10) }).populate("userId", "name").lean()
    : [];
  const checkedInIds = new Set(teamToday.map((a: any) => a.userId?._id?.toString()));
  const teamMembers = isAdmin
    ? await User.find({ organizationId: session.user.organizationId, active: true }).sort({ name: 1 }).select("name _id").lean()
    : [];
  return (
    <PageShell title="Attendance" description="Track your daily check-ins with selfie verification">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{thisMonthCount} / {totalDays}</p>
            <p className="text-xs text-muted-foreground">days marked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{records.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {records.length > 0 ? new Date(records[0].checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {records.length > 0 ? new Date(records[0].date + "T00:00:00").toLocaleDateString() : "Never"}
            </p>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Team Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{teamToday.length}/{teamMembers.length}</p>
              <p className="text-xs text-muted-foreground">members checked in</p>
            </CardContent>
          </Card>
        )}
      </div>
      {isAdmin && <AttendanceTeam members={JSON.parse(JSON.stringify(teamMembers))} checkedInIds={Array.from(checkedInIds)} teamToday={JSON.parse(JSON.stringify(teamToday))} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceHistory records={records} />
          </CardContent>
        </Card>
        <AttendanceCalendar records={records} currentMonth={currentMonth} />
      </div>
    </PageShell>
  );
}
