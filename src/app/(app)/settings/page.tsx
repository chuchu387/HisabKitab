import { notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/features/forms/settings-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Organization } from "@/models/Organization";

export default async function SettingsPage() {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const organization = await Organization.findById(organizationId).lean();
  if (!organization) notFound();
  return (
    <PageShell title="Organization Settings" description="Update organization profile and the general budget used for general expenses.">
      <SettingsForm organization={JSON.parse(JSON.stringify(organization))} />
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Organization Export</h2>
            <p className="mt-1 text-sm text-muted-foreground">Download tenant data for audit backup. Password hashes and receipt files are not included.</p>
          </div>
          {session.user.role === "owner" ? <Button asChild variant="secondary"><Link href="/api/organization/export">Download JSON</Link></Button> : <p className="text-sm text-muted-foreground">Owner only</p>}
        </div>
      </section>
    </PageShell>
  );
}
