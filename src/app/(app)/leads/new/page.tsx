import { PageShell } from "@/components/page-shell";
import { LeadForm } from "@/features/forms/lead-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { User } from "@/models/User";
import { Campaign } from "@/models/Campaign";
import { Project } from "@/models/Project";
import { Product } from "@/models/Product";

export default async function NewLeadPage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const [users, campaigns, projects, products] = await Promise.all([
    User.find({ organizationId, active: true }).sort({ name: 1 }).select("name email").lean(),
    Campaign.find({ organizationId, active: true }).sort({ name: 1 }).select("name").lean(),
    Project.find({ organizationId, status: "active" }).sort({ name: 1 }).select("name code").lean(),
    Product.find({ organizationId, active: true }).sort({ name: 1 }).select("name category").lean()
  ]);
  return <PageShell title="Create Lead" breadcrumb={[{ label: "Leads", href: "/leads" }, { label: "Create" }]}><LeadForm users={JSON.parse(JSON.stringify(users))} campaigns={JSON.parse(JSON.stringify(campaigns))} projects={JSON.parse(JSON.stringify(projects))} products={JSON.parse(JSON.stringify(products))} /></PageShell>;
}
