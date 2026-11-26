import { PageShell } from "@/components/page-shell";
import { TargetManager } from "@/features/crm/target-manager";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { getSalesData } from "@/actions/commissions";

export default async function TargetsPage() {
  await requireFeature("targetsView");
  await connectToDatabase();
  const month = new Date().toISOString().slice(0, 7);
  const data = await getSalesData(month, "targetsView");
  return (
    <PageShell title="Sales Targets">
      <TargetManager users={data.users} targets={data.targets} month={month} />
    </PageShell>
  );
}
