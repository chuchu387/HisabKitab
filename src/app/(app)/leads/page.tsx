import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteLead } from "@/actions/leads";
import { LeadImportForm } from "@/features/forms/lead-import-form";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Lead } from "@/models/Lead";
import { leadStatusLabels, leadStatusColors, leadSourceLabels } from "@/constants";

export default async function LeadsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  const sourceFilter = typeof params?.source === "string" ? params.source : "";
  const statusFilter = typeof params?.status === "string" ? params.status : "";
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  if (q) query.$or = [{ name: new RegExp(q, "i") }, { company: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];
  if (sourceFilter) query.source = sourceFilter;
  if (statusFilter) query.status = statusFilter;
  const [leads, totalCount] = await Promise.all([
    Lead.find(query).sort({ createdAt: -1 }).populate("assignedTo", "name").lean() as any,
    Lead.countDocuments({ organizationId: new Types.ObjectId(organizationId) })
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
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <LeadImportForm />
      <DataTable data={leads} pagination={{ basePath: "/leads", searchParams: params }} columns={[
        { header: "Name", cell: (lead: any) => <Link className="font-medium hover:text-primary" href={`/leads/${lead._id}`}>{lead.name}</Link> },
        { header: "Company", cell: (lead: any) => lead.company || "-" },
        { header: "Contact", cell: (lead: any) => <div>{lead.email ? <a href={`mailto:${lead.email}`} className="block text-primary hover:underline">{lead.email}</a> : null}{lead.phone ? <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a> : lead.email ? null : "-"}</div> },
        { header: "Source", cell: (lead: any) => <Badge variant="info">{leadSourceLabels[lead.source as keyof typeof leadSourceLabels] || lead.source}</Badge> },
        { header: "Status", cell: (lead: any) => <Badge variant={(leadStatusColors[lead.status as keyof typeof leadStatusColors] || "default") as any}>{leadStatusLabels[lead.status as keyof typeof leadStatusLabels] || lead.status}</Badge> },
        { header: "Value", cell: (lead: any) => lead.estimatedValue ? money(lead.estimatedValue) : "-" },
        { header: "Assigned", cell: (lead: any) => lead.assignedTo?.name || "-" },
        { header: "Follow-up", cell: (lead: any) => lead.followUpDate ? formatDate(lead.followUpDate) : "-" },
        { header: "Actions", cell: (lead: any) => <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/leads/${lead._id}/edit`}>Edit</Link></Button><form action={deleteLead}><input type="hidden" name="id" value={lead._id.toString()} /><ConfirmButton label="Delete" /></form></div> }
      ]} />
    </PageShell>
  );
}
