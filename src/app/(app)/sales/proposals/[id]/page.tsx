import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { formatDate, money, safeObjectId } from "@/lib/utils";
import { Proposal } from "@/models/Proposal";
import { Lead } from "@/models/Lead";
import { sendProposal, acceptProposal, deleteProposal } from "@/actions/proposals";
import { proposalStatusLabels } from "@/constants";
import type { ProposalStatus } from "@/constants";

export default async function ProposalDetailPage({ params }: any) {
  const { organizationId, session } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const routeParams = await params;
  const objectId = safeObjectId(routeParams.id);
  if (!objectId) notFound();
  const proposal = await Proposal.findOne({ _id: routeParams.id, organizationId }).lean() as any;
  if (!proposal) notFound();
  const proposalStatus = proposal.status as ProposalStatus;
  let lead = null;
  if (proposal.leadId) {
    const leadDoc = await Lead.findOne({ _id: proposal.leadId, organizationId }).select("name company email phone").lean() as any;
    lead = leadDoc;
  }
  const canManage = ["owner", "admin"].includes(session.user.role);
  const isTerminal = ["accepted", "rejected", "withdrawn"].includes(proposalStatus);
  return (
    <PageShell title={proposal.title} description={`Rs. ${money(proposal.amount)}`} breadcrumb={[{ label: "Proposals", href: "/sales/proposals" }, { label: proposal.title }]}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard label="Amount" value={money(proposal.amount)} />
        <InfoCard label="Status" value={<Badge variant={proposalStatus === "accepted" ? "success" : proposalStatus === "rejected" ? "danger" : proposalStatus === "sent" ? "info" : "muted"}>{proposalStatusLabels[proposalStatus] || proposalStatus}</Badge>} />
        <InfoCard label="Sent At" value={proposal.sentAt ? formatDate(proposal.sentAt) : "Not sent"} />
        {proposal.acceptedAt && <InfoCard label="Accepted At" value={formatDate(proposal.acceptedAt)} />}
        {lead && <InfoCard label="Lead" value={<Link className="hover:text-primary" href={`/leads/${lead._id}`}>{lead.name}</Link>} />}
      </div>
      {proposal.description && (
        <Card>
          <CardContent className="p-4 text-sm sm:p-5"><p className="text-muted-foreground">Description</p><p className="mt-1 whitespace-pre-wrap">{proposal.description}</p></CardContent>
        </Card>
      )}
      {canManage && !isTerminal && (
        <div className="flex flex-wrap gap-2">
          {proposalStatus === "draft" && (
            <form action={sendProposal}>
              <input type="hidden" name="id" value={proposal._id.toString()} />
              <Button variant="outline">Mark as Sent</Button>
            </form>
          )}
          <form action={acceptProposal}>
            <input type="hidden" name="id" value={proposal._id.toString()} />
            <input type="hidden" name="createClient" value="on" />
            <Button>Accept & Convert</Button>
          </form>
          {proposalStatus === "draft" && (
            <form action={deleteProposal}>
              <input type="hidden" name="id" value={proposal._id.toString()} />
              <Button variant="destructive">Delete</Button>
            </form>
          )}
        </div>
      )}
      {proposal.convertedToClientId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm sm:p-5">
            <p className="font-semibold text-primary">Converted</p>
            <p>Client created · <Link className="hover:text-primary" href={`/clients/${proposal.convertedToClientId}`}>View client</Link></p>
            {proposal.convertedToProjectId && <p>Project created · <Link className="hover:text-primary" href={`/projects/${proposal.convertedToProjectId}`}>View project</Link></p>}
            {proposal.convertedToInvoiceId && <p>Invoice created · <Link className="hover:text-primary" href={`/invoices/${proposal.convertedToInvoiceId}`}>View invoice</Link></p>}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 font-medium">{value}</div></CardContent>
    </Card>
  );
}
