import { PageShell } from "@/components/page-shell";
import { CommissionList } from "@/features/crm/commission-list";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { getSalesData } from "@/actions/commissions";

export default async function CommissionsPage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const month = new Date().toISOString().slice(0, 7);
  const data = await getSalesData(organizationId, month);
  return (
    <PageShell title="Commissions">
      <CommissionList commissions={data.commissions} users={data.users} />
    </PageShell>
  );
}
