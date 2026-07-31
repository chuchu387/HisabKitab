import { Types } from "mongoose";
import { PageShell } from "@/components/page-shell";
import { PermissionManager } from "./permission-manager";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { User } from "@/models/User";
import { featureLabels, featureKeys } from "@/constants/permissions";

export default async function PermissionsPage() {
  const { session, organizationId } = await requireFeature("usersManage");
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const users = await User.find({ organizationId: oid, role: { $ne: "super_admin" } }).select("name email role active permissions").sort({ role: 1, name: 1 }).lean() as any[];
  return (
    <PageShell title="Permissions" description="Promote staff to co-owner or admin, or grant/restrict individual feature access for each member.">
      <PermissionManager
        users={JSON.parse(JSON.stringify(users))}
        featureLabels={featureLabels}
        featureKeys={[...featureKeys]}
        currentUserId={session.user.userId}
        currentRole={session.user.role}
      />
    </PageShell>
  );
}
