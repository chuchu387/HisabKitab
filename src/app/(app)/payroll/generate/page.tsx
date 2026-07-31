import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { SalarySetting } from "@/models/SalarySetting";
import { User } from "@/models/User";
import { GeneratePayrollForm } from "@/features/payroll/generate-form";

export default async function GeneratePayrollPage({ searchParams }: any) {
  await requireFeature("payrollManage");
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const month = typeof params?.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const [users, settings] = await Promise.all([
    User.find({ organizationId, active: true, role: { $in: ["staff", "admin"] } }).sort({ name: 1 }).select("name role").lean(),
    SalarySetting.find({ organizationId }).select("userId baseSalary overtimeRate").lean()
  ]);
  const settingsByUser = new Map(settings.map((setting: any) => [setting.userId.toString(), setting]));
  const usersWithSettings = users.map((user: any) => ({ ...user, _id: user._id.toString(), setting: settingsByUser.get(user._id.toString()) ? JSON.parse(JSON.stringify(settingsByUser.get(user._id.toString()))) : null }));

  return (
    <PageShell title="Generate Payroll" action={<Button asChild variant="outline"><Link href="/payroll">Back to Payroll</Link></Button>}>
      <Card>
        <CardContent className="p-5">
          <GeneratePayrollForm month={month} users={usersWithSettings} />
          {usersWithSettings.length === 0 && <p className="text-sm text-muted-foreground">No staff members found. Add users first.</p>}
        </CardContent>
      </Card>
    </PageShell>
  );
}
