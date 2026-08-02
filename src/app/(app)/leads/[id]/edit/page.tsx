import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { LeadForm } from "@/features/forms/lead-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { User } from "@/models/User";
import { Campaign } from "@/models/Campaign";
import { Project } from "@/models/Project";
import { Product } from "@/models/Product";

export default async function EditLeadPage({ params }: any) {
  const { organizationId } = await requireFeature("leadsManage");
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const [lead, users, campaigns, projects, products] = await Promise.all([
    Lead.findOne({ _id: routeParams.id, organizationId }).lean(),
    User.find({ organizationId, active: true }).sort({ name: 1 }).select("name email").lean(),
    Campaign.find({ organizationId, active: true }).sort({ name: 1 }).select("name").lean(),
    Project.find({ organizationId, status: "active" }).sort({ name: 1 }).select("name code").lean(),
    Product.find({ organizationId, active: true }).sort({ name: 1 }).select("name category").lean()
  ]);
  if (!lead) notFound();
  return <PageShell title="Edit Lead" breadcrumb={[{ label: "Leads", href: "/leads" }, { label: "Edit" }]}><LeadForm lead={JSON.parse(JSON.stringify(lead))} users={JSON.parse(JSON.stringify(users))} campaigns={JSON.parse(JSON.stringify(campaigns))} projects={JSON.parse(JSON.stringify(projects))} products={JSON.parse(JSON.stringify(products))} /></PageShell>;
}
