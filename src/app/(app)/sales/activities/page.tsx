import Link from "next/link";
import { Types } from "mongoose";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { LeadActivity } from "@/models/LeadActivity";
import { Lead } from "@/models/Lead";

export default async function ActivitiesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const typeFilter = typeof params?.type === "string" ? params.type : "";
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  if (typeFilter) query.type = typeFilter;
  const activities = await LeadActivity.find(query).sort({ createdAt: -1 }).populate("userId", "name").populate("leadId", "name").lean() as any[];
  return (
    <PageShell title="Sales Activities" description="Timeline of all sales activities across leads.">
      <DataTable data={activities} pagination={{ basePath: "/sales/activities", searchParams: params }} columns={[
        { header: "Type", cell: (a: any) => <Badge variant="info">{a.type.replace(/_/g, " ")}</Badge> },
        { header: "Description", cell: (a: any) => a.description || "-" },
        { header: "Lead", cell: (a: any) => a.leadId ? <Link className="hover:text-primary" href={`/leads/${a.leadId._id}`}>{a.leadId.name}</Link> : "-" },
        { header: "User", cell: (a: any) => a.userId?.name || "-" },
        { header: "Date", cell: (a: any) => formatDate(a.createdAt) }
      ]} />
    </PageShell>
  );
}
