import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/features/forms/settings-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Organization } from "@/models/Organization";

export default async function SettingsPage() {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const organization = await Organization.findById(organizationId).lean();
  if (!organization) notFound();
  return <PageShell title="Organization Settings"><SettingsForm organization={JSON.parse(JSON.stringify(organization))} /></PageShell>;
}
