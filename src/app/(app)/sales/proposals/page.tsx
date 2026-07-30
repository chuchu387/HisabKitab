import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { PageShell } from "@/components/page-shell";
import { deleteProposal, sendProposal, acceptProposal } from "@/actions/proposals";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money } from "@/lib/utils";
import { Proposal } from "@/models/Proposal";
import { proposalStatusLabels } from "@/constants";

export default async function ProposalsPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const statusFilter = typeof params?.status === "string" ? params.status : "";
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  if (statusFilter) query.status = statusFilter;
  const proposals = await Proposal.find(query).sort({ createdAt: -1 }).populate("leadId", "name").lean() as any[];
  const canManage = ["owner", "admin"].includes(session.user.role);
  return (
    <PageShell title="Proposals" description="Create and manage sales proposals. Accepted proposals can be converted to clients and projects." action={canManage && <Button asChild><Link href="/sales/proposals/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <FilterForm className="filter-bar">
        <select className="native-control" name="status" defaultValue={statusFilter}>
          <option value="">All statuses</option>
          {Object.entries(proposalStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <Button variant="outline">Filter</Button>
      </FilterForm>
      <DataTable data={proposals} pagination={{ basePath: "/sales/proposals", searchParams: params }} columns={[
        { header: "Title", cell: (p: any) => <Link className="font-medium hover:text-primary" href={`/sales/proposals/${p._id}`}>{p.title}</Link> },
        { header: "Amount", cell: (p: any) => money(p.amount) },
        { header: "Lead", cell: (p: any) => p.leadId?.name || "-" },
        { header: "Status", cell: (p: any) => <Badge variant={p.status === "accepted" ? "success" : p.status === "rejected" ? "danger" : p.status === "sent" ? "info" : "muted"}>{proposalStatusLabels[p.status as keyof typeof proposalStatusLabels] || p.status}</Badge> },
        { header: "Sent", cell: (p: any) => p.sentAt ? formatDate(p.sentAt) : "-" },
        { header: "Created", cell: (p: any) => formatDate(p.createdAt) },
        { header: "Actions", cell: (p: any) => canManage ? <div className="flex gap-2">
          {p.status === "draft" && <form action={sendProposal}><input type="hidden" name="id" value={p._id.toString()} /><Button variant="outline" size="sm">Send</Button></form>}
          {p.status !== "accepted" && p.status !== "rejected" && <form action={acceptProposal}><input type="hidden" name="id" value={p._id.toString()} /><Button variant="outline" size="sm">Accept</Button></form>}
          {p.status === "draft" && <form action={deleteProposal}><input type="hidden" name="id" value={p._id.toString()} /><ConfirmButton /></form>}
        </div> : null }
      ]} />
    </PageShell>
  );
}
