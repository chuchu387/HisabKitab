import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { getDataHealth, type HealthIssue } from "@/services/data-health";

export default async function DataHealthPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const health = await getDataHealth(organizationId);
  return (
    <PageShell title="Data Health" description="Audit-readiness checks for accounting data, fiscal years, VAT, cash, invoices, and reconciliation quality.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Critical Issues" value={health.summary.critical} />
        <StatCard label="Warnings" value={health.summary.warning} />
        <StatCard label="Cash / Bank Balance" value={health.summary.cashAtBank} currency />
        <StatCard label="Outside FY Records" value={health.summary.transactionsOutsideFiscalYears} />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold">Generated {formatDate(health.generatedAt)}</p>
            <p className="text-muted-foreground">Resolve critical items before downloading final reports for auditor handoff.</p>
          </div>
          <Button asChild variant="secondary"><Link href="/accounts">Open Statements</Link></Button>
        </CardContent>
      </Card>
      <DataTable data={health.issues} pagination={{ basePath: "/data-health", searchParams: params }} columns={[
        { header: "Severity", cell: (issue: HealthIssue) => <SeverityBadge severity={issue.severity} /> },
        { header: "Area", cell: (issue: HealthIssue) => issue.area },
        { header: "Issue", cell: (issue: HealthIssue) => <div><p className="font-medium">{issue.title}</p><p className="text-xs text-muted-foreground">{issue.detail}</p></div> },
        { header: "Count", cell: (issue: HealthIssue) => issue.count ?? "-" },
        { header: "Action", cell: (issue: HealthIssue) => <Button asChild size="sm" variant="outline"><Link href={issue.href}>Review</Link></Button> }
      ]} />
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <p><span className="font-semibold">Bank opening balances:</span> {money(health.summary.bankOpeningBalance)}</p>
          <p className="mt-1 text-muted-foreground">Use Bank Accounts for cash/bank openings. Use Opening Balances only for non-cash accounts your auditor asks to carry forward.</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge variant="danger"><AlertTriangle className="h-3 w-3" />Critical</Badge>;
  if (severity === "warning") return <Badge variant="warning"><Info className="h-3 w-3" />Warning</Badge>;
  return <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Info</Badge>;
}
