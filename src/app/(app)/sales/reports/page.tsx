import { Types } from "mongoose";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { SimpleBarChart, TrendChart, DonutChart } from "@/components/charts";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { LeadTask } from "@/models/LeadTask";
import { Proposal } from "@/models/Proposal";
import { leadStatusLabels, leadSourceLabels } from "@/constants";

export default async function SalesReportsPage() {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const [allLeads, allTasks, allProposals] = await Promise.all([
    Lead.find({ organizationId: oid }).populate("assignedTo", "name").lean() as any,
    LeadTask.find({ organizationId: oid }).lean(),
    Proposal.find({ organizationId: oid }).lean()
  ]);
  const totalLeads = allLeads.length;
  const wonLeads = allLeads.filter((l: any) => l.status === "won").length;
  const lostLeads = allLeads.filter((l: any) => l.status === "lost").length;
  const activeLeads = totalLeads - wonLeads - lostLeads;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const pipelineValue = allLeads.filter((l: any) => l.status !== "won" && l.status !== "lost").reduce((sum: number, l: any) => sum + (l.estimatedValue || 0), 0);
  const wonValue = allLeads.filter((l: any) => l.status === "won").reduce((sum: number, l: any) => sum + (l.estimatedValue || 0), 0);
  const proposalValue = allProposals.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const proposedAccepted = allProposals.filter((p: any) => p.status === "accepted").reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const pendingTasks = allTasks.filter((t: any) => t.status !== "closed" && t.status !== "completed").length;
  const overdueTasks = allTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "closed" && t.status !== "completed").length;

  const sourceData: Record<string, { count: number; won: number; value: number }> = allLeads.reduce((acc: Record<string, { count: number; won: number; value: number }>, lead: any) => {
    const source = lead.source || "other";
    if (!acc[source]) acc[source] = { count: 0, won: 0, value: 0 };
    acc[source].count += 1;
    if (lead.status === "won") acc[source].won += 1;
    acc[source].value += lead.estimatedValue || 0;
    return acc;
  }, {} as Record<string, { count: number; won: number; value: number }>);
  const sourceRows = Object.keys(sourceData).map((source) => {
    const data = sourceData[source] as { count: number; won: number; value: number };
    return {
      source: leadSourceLabels[source as keyof typeof leadSourceLabels] || source,
      count: data.count,
      won: data.won,
      rate: data.count > 0 ? Math.round((data.won / data.count) * 100) : 0,
      value: data.value
    };
  });
  const donutData = Object.keys(sourceData).map((source) => ({
    name: leadSourceLabels[source as keyof typeof leadSourceLabels] || source,
    amount: sourceData[source].count
  }));

  const monthlyData: Record<string, { leads: number; won: number; value: number }> = {};
  allLeads.forEach((lead: any) => {
    if (!lead.createdAt) return;
    const d = new Date(lead.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyData[key]) monthlyData[key] = { leads: 0, won: 0, value: 0 };
    monthlyData[key].leads += 1;
    if (lead.status === "won") monthlyData[key].won += 1;
    monthlyData[key].value += lead.estimatedValue || 0;
  });
  const trendData = Object.keys(monthlyData).sort().map((key) => ({
    month: key,
    amount: monthlyData[key].value,
    leads: monthlyData[key].leads
  }));

  const userData = allLeads.reduce((acc: Record<string, { name: string; leads: number; won: number; value: number }>, lead: any) => {
    const userId = lead.assignedTo?._id?.toString() || "unassigned";
    const userName = lead.assignedTo?.name || "Unassigned";
    if (!acc[userId]) {
      acc[userId] = { name: userName, leads: 0, won: 0, value: 0 };
    }
    acc[userId].leads += 1;
    if (lead.status === "won") acc[userId].won += 1;
    acc[userId].value += lead.estimatedValue || 0;
    return acc;
  }, {} as Record<string, { name: string; leads: number; won: number; value: number }>);
  const userRows = (Object.values(userData) as { name: string; leads: number; won: number; value: number }[]).map((u) => ({
    name: u.name,
    leads: u.leads,
    won: u.won,
    value: u.value,
    rate: u.leads > 0 ? Math.round((u.won / u.leads) * 100) : 0
  }));

  const statusBreakdown = (["new", "contacted", "meeting_scheduled", "proposal_sent", "negotiation", "won", "lost"] as const).map((s) => ({
    status: leadStatusLabels[s],
    count: allLeads.filter((l: any) => l.status === s).length,
    value: allLeads.filter((l: any) => l.status === s).reduce((sum: number, l: any) => sum + (l.estimatedValue || 0), 0)
  }));

  const staffChartData = userRows.filter((u) => u.won > 0).sort((a, b) => b.won - a.won).slice(0, 8);

  return (
    <PageShell title="Sales Reports" description="Lead generation, pipeline value, conversion tracking, and staff performance.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Leads" value={totalLeads} />
        <StatCard label="Active Leads" value={activeLeads} />
        <StatCard label="Won" value={wonLeads} />
        <StatCard label="Lost" value={lostLeads} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Conversion Rate" value={conversionRate} />
        <StatCard label="Pipeline Value" value={pipelineValue} currency />
        <StatCard label="Won Revenue" value={wonValue} currency />
        <StatCard label="Proposal Value" value={proposalValue} currency />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Proposals Accepted" value={proposedAccepted} currency />
        <StatCard label="Pending Tasks" value={pendingTasks} />
        <StatCard label="Overdue Tasks" value={overdueTasks} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SimpleBarChart title="Monthly Pipeline Value (Rs)" data={trendData} xKey="month" yKey="amount" />
        </div>
        <DonutChart title="Leads by Source" data={donutData} nameKey="name" valueKey="amount" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {staffChartData.length > 1 && <SimpleBarChart title="Won Deals by Staff" data={staffChartData} xKey="name" yKey="won" />}
        <TrendChart data={trendData} title="Monthly Pipeline Value" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Lead Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={statusBreakdown} columns={[
              { header: "Status", cell: (r: any) => r.status },
              { header: "Count", cell: (r: any) => r.count },
              { header: "Value", cell: (r: any) => money(r.value) }
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lead Source Performance</CardTitle></CardHeader>
          <CardContent>
            <DataTable data={sourceRows} columns={[
              { header: "Source", cell: (r: any) => r.source },
              { header: "Leads", cell: (r: any) => r.count },
              { header: "Won", cell: (r: any) => r.won },
              { header: "Conversion", cell: (r: any) => `${r.rate}%` },
              { header: "Pipeline Value", cell: (r: any) => money(r.value) }
            ]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Staff Sales Performance</CardTitle></CardHeader>
        <CardContent>
          <DataTable data={userRows} columns={[
            { header: "Staff", cell: (r: any) => r.name },
            { header: "Leads", cell: (r: any) => r.leads },
            { header: "Won", cell: (r: any) => r.won },
            { header: "Conversion", cell: (r: any) => `${r.rate}%` },
            { header: "Pipeline Value", cell: (r: any) => money(r.value) }
          ]} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
