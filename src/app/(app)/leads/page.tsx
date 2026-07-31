import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { LeadImportForm } from "@/features/forms/lead-import-form";
import { LeadsTable } from "@/features/leads/leads-table";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { Project } from "@/models/Project";
import { leadStatusLabels } from "@/constants";

export default async function LeadsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  const sourceFilter = typeof params?.source === "string" ? params.source : "";
  const statusFilter = typeof params?.status === "string" ? params.status : "";
  const projectFilter = typeof params?.projectId === "string" ? params.projectId : "";
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  if (q) query.$or = [{ name: new RegExp(q, "i") }, { company: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];
  if (sourceFilter) query.source = sourceFilter;
  if (statusFilter) query.status = statusFilter;
  if (projectFilter && Types.ObjectId.isValid(projectFilter)) query.projectId = new Types.ObjectId(projectFilter);
  const [leads, totalCount, projects] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).populate("assignedTo", "name").populate("projectId", "name code").lean() as any,
    Lead.countDocuments({ organizationId: new Types.ObjectId(organizationId) }),
    Project.find({ organizationId, status: "active" }).sort({ name: 1 }).select("name code").lean()
  ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayFollowUps = leads.filter((l: any) => {
    if (!l.followUpDate) return false;
    const d = new Date(l.followUpDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;
  return (
    <PageShell title="Leads" description="Track potential clients from first contact to conversion." action={<div className="flex gap-2"><Button asChild><Link href="/leads/new"><Plus className="h-4 w-4" />Create</Link></Button></div>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Leads</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{totalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-ups Today</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className={`text-2xl font-semibold ${todayFollowUps > 0 ? "text-accent" : ""}`}>{todayFollowUps}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline Value</CardTitle></CardHeader>
          <CardContent className="pt-0"><p className="text-2xl font-semibold">{money(leads.filter((l: any) => l.status !== "won" && l.status !== "lost").reduce((s: number, l: any) => s + (l.estimatedValue || 0), 0))}</p></CardContent>
        </Card>
      </div>
      <FilterForm className="filter-bar">
        <SearchBar placeholder="Search leads" defaultValue={q} />
        <select className="native-control" name="source" defaultValue={sourceFilter}>
          <option value="">All sources</option>
          {(["website", "referral", "facebook", "instagram", "linkedin", "cold_call", "existing_client", "walk_in", "other"] as const).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select className="native-control" name="status" defaultValue={statusFilter}>
          <option value="">All statuses</option>
          {Object.entries(leadStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className="native-control" name="projectId" defaultValue={projectFilter}>
          <option value="">All projects</option>
          {projects.map((p: any) => <option key={p._id.toString()} value={p._id.toString()}>{p.name}</option>)}
        </select>
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <div className="flex items-start gap-3">
        <LeadImportForm className="flex-1" />
        <a href="/leads-sample.csv" download className="shrink-0 rounded-lg border bg-card p-4 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground">
          <Download className="mb-1 h-5 w-5" />
          Download<br />Sample CSV
        </a>
      </div>
      <LeadsTable leads={JSON.parse(JSON.stringify(leads))} pagination={{ basePath: "/leads", searchParams: params }} />
    </PageShell>
  );
}
