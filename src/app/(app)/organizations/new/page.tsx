import { PageShell } from "@/components/page-shell";
import { OrganizationForm } from "@/features/forms/organization-form";
import { requireRole } from "@/lib/permissions";

export default async function NewOrganizationPage() {
  await requireRole(["super_admin"]);
  return <PageShell title="Create Organization" breadcrumb={[{ label: "Organizations", href: "/organizations" }, { label: "Create" }]}><OrganizationForm /></PageShell>;
}
