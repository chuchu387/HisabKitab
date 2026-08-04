import { connectToDatabase } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { PageShell } from "@/components/page-shell";
import { SelfieGallery } from "@/features/attendance/selfie-gallery";

async function getAllSelfies(organizationId: string) {
  await connectToDatabase();
  const superAdmins = await User.find({ organizationId, role: "super_admin" }).select("_id").lean();
  const excluded = superAdmins.map((u: any) => u._id);
  const records = await Attendance.find({ organizationId, userId: { $nin: excluded }, selfieId: { $ne: null } })
    .populate("userId", "name role")
    .sort({ date: -1, checkInTime: -1 })
    .lean();
  return JSON.parse(JSON.stringify(records));
}

export default async function SelfiesPage() {
  const session = await requireSession();
  const records = await getAllSelfies(session.user.organizationId!);
  return (
    <PageShell title="Selfie Gallery" description="All captured selfies across all days">
      <SelfieGallery records={records} />
    </PageShell>
  );
}
