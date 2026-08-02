import { PageShell } from "@/components/page-shell";
import { AttendanceSettingsForm } from "@/features/attendance/attendance-settings-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { AttendanceSetting } from "@/models/AttendanceSetting";

export default async function AttendanceSettingsPage() {
  const { organizationId } = await requireFeature("attendanceManage");
  await connectToDatabase();
  const settings = await AttendanceSetting.findOne({ organizationId }).lean();
  return (
    <PageShell title="Attendance Settings" description="Configure work hours, grace period, working days, holidays, and missing-attendance reminders.">
      <AttendanceSettingsForm settings={JSON.parse(JSON.stringify(settings))} />
    </PageShell>
  );
}
