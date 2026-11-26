import { PageShell } from "@/components/page-shell";
import { CampaignList } from "@/features/crm/campaign-list";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { getCampaignStats } from "@/actions/campaigns";

export default async function CampaignsPage() {
  await requireFeature("campaignsView");
  await connectToDatabase();
  const campaigns = await getCampaignStats();
  return (
    <PageShell title="Campaigns">
      <CampaignList campaigns={campaigns} />
    </PageShell>
  );
}
