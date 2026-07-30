import { PageShell } from "@/components/page-shell";
import { LeadForm } from "@/features/forms/lead-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { User } from "@/models/User";

export default async function NewLeadPage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const users = await User.find({ organizationId, active: true }).sort({ name: 1 }).select("name email").lean();
  return <PageShell title="Create Lead" breadcrumb={[{ label: "Leads", href: "/leads" }, { label: "Create" }]}><LeadForm users={JSON.parse(JSON.stringify(users))} /></PageShell>;
}
