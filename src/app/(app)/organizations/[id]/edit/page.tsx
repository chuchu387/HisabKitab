import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { OrganizationForm } from "@/features/forms/organization-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { Organization } from "@/models/Organization";

export default async function EditOrganizationPage({ params }: any) {
  await requireRole(["super_admin"]);
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const organization = await Organization.findById(routeParams.id).lean();
  if (!organization) notFound();
  return <PageShell title="Edit Organization" breadcrumb={[{ label: "Organizations", href: "/organizations" }, { label: "Edit" }]}><OrganizationForm organization={JSON.parse(JSON.stringify(organization))} /></PageShell>;
}
