import { PageShell } from "@/components/page-shell";
import { CampaignList } from "@/features/crm/campaign-list";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { getCampaignStats } from "@/actions/campaigns";

export default async function CampaignsPage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const campaigns = await getCampaignStats(organizationId);
  return (
    <PageShell title="Campaigns">
      <CampaignList campaigns={campaigns} />
    </PageShell>
  );
}
