import { PageShell } from "@/components/page-shell";
import { ProposalForm } from "@/features/forms/proposal-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Lead } from "@/models/Lead";

export default async function NewProposalPage() {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const leads = await Lead.find({ organizationId, status: { $nin: ["won", "lost"] } }).sort({ name: 1 }).select("name company").lean();
  return <PageShell title="Create Proposal" breadcrumb={[{ label: "Proposals", href: "/sales/proposals" }, { label: "Create" }]}><ProposalForm leads={JSON.parse(JSON.stringify(leads))} /></PageShell>;
}
