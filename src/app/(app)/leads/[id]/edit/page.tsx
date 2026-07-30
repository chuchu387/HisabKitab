import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { LeadForm } from "@/features/forms/lead-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { User } from "@/models/User";

export default async function EditLeadPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const [lead, users] = await Promise.all([
    Lead.findOne({ _id: routeParams.id, organizationId }).lean(),
    User.find({ organizationId, active: true }).sort({ name: 1 }).select("name email").lean()
  ]);
  if (!lead) notFound();
  return <PageShell title="Edit Lead" breadcrumb={[{ label: "Leads", href: "/leads" }, { label: "Edit" }]}><LeadForm lead={JSON.parse(JSON.stringify(lead))} users={JSON.parse(JSON.stringify(users))} /></PageShell>;
}
