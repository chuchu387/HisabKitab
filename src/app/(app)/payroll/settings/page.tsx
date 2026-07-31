import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { SalarySetting } from "@/models/SalarySetting";
import { User } from "@/models/User";
import { SalarySettingsForm } from "@/features/payroll/salary-settings-form";

export default async function SalarySettingsPage() {
  await requireFeature("payrollManage");
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const [users, settings] = await Promise.all([
    User.find({ organizationId, active: true, role: { $in: ["staff", "admin"] } }).sort({ name: 1 }).select("name role").lean(),
    SalarySetting.find({ organizationId }).lean()
  ]);
  const settingsByUser = new Map(settings.map((setting: any) => [setting.userId.toString(), setting]));
  const rows = users.map((user: any) => ({ ...user, _id: user._id.toString(), setting: settingsByUser.get(user._id.toString()) ? JSON.parse(JSON.stringify(settingsByUser.get(user._id.toString()))) : null }));

  return (
    <PageShell title="Salary Settings" action={<Button asChild variant="outline"><Link href="/payroll"><ArrowLeft className="h-4 w-4" />Payroll</Link></Button>}>
      {rows.length ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Set base salary, recurring allowances and overtime rate per staff member. These are snapshotted into payslips at generation time.</p>
          {rows.map((user: any) => (
            <SalarySettingsForm key={user._id} user={user} />
          ))}
        </div>
      ) : (
        <EmptyState title="No staff found" description="Add staff members first, then configure their salaries." />
      )}
    </PageShell>
  );
}
