import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { getAttendanceReport } from "@/actions/attendance";
import { nepalDateString } from "@/lib/timezone";
import { AttendanceReportView } from "@/features/attendance/attendance-report";

export default async function AttendanceReportsPage({ searchParams }: any) {
  const { session, organizationId } = await requireFeature("attendanceManage");
  await connectToDatabase();
  const params = await searchParams;
  const month = typeof params?.month === "string" ? params.month : nepalDateString().slice(0, 7);
  const data = await getAttendanceReport(organizationId, month);
  return (
    <PageShell title="Attendance Reports" description={`Monthly attendance summary for ${month}`}>
      <AttendanceReportView data={data} month={month} />
    </PageShell>
  );
}
