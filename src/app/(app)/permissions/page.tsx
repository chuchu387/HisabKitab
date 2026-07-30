import { Types } from "mongoose";
import { PageShell } from "@/components/page-shell";
import { PermissionManager } from "./permission-manager";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { User } from "@/models/User";
import { resolvePermissions, featureLabels, featureKeys, type FeatureKey } from "@/constants/permissions";

export default async function PermissionsPage() {
  const { session, organizationId } = await requireTenant();
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const users = await User.find({ organizationId: oid, role: { $ne: "owner" } }).select("name email role active permissions").sort({ name: 1 }).lean() as any[];
  return (
    <PageShell title="Permissions" description="Grant or restrict feature access for each staff member. Overrides the default role-based access.">
      <PermissionManager
        users={JSON.parse(JSON.stringify(users))}
        featureLabels={featureLabels}
        featureKeys={[...featureKeys]}
        currentUserId={session.user.userId}
      />
    </PageShell>
  );
}
