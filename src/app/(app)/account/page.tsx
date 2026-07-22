import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/page-shell";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { roleLabels } from "@/constants";
import { requireSession } from "@/lib/permissions";

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <PageShell title="Account" description="Manage your login security and account details.">
      <div className="rounded-lg border bg-card/95 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{session.user.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
          </div>
          <Badge variant="info">{roleLabels[session.user.role]}</Badge>
        </div>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Change Password</h2>
        <ChangePasswordForm />
      </section>
    </PageShell>
  );
}
