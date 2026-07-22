import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { StatCard } from "@/components/stat-card";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Client } from "@/models/Client";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";

export default async function ClientDetailPage({ params, searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const routeParams = await params;
  const queryParams = await searchParams;
  const client = await Client.findOne({ _id: routeParams.id, organizationId }).lean();
  if (!client) notFound();
  const oid = new Types.ObjectId(organizationId);
  const clientId = new Types.ObjectId(routeParams.id);
  const projects = await Project.aggregate([
    { $match: { organizationId: oid, clientId } },
    { $lookup: { from: ProjectPayment.collection.name, localField: "_id", foreignField: "projectId", as: "payments" } },
    { $lookup: { from: Expense.collection.name, localField: "_id", foreignField: "projectId", as: "expenses" } },
    {
      $addFields: {
        received: { $cond: [{ $gt: [{ $ifNull: ["$receivedAmount", 0] }, 0] }, { $ifNull: ["$receivedAmount", 0] }, { $sum: "$payments.amount" }] },
        expense: { $sum: { $map: { input: { $filter: { input: "$expenses", as: "expense", cond: { $eq: ["$$expense.approvalStatus", "approved"] } } }, as: "expense", in: "$$expense.amount" } } }
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
  const totals = projects.reduce((acc: any, project: any) => {
    acc.budget += project.totalBudget ?? 0;
    acc.received += project.received ?? 0;
    acc.expense += project.expense ?? 0;
    return acc;
  }, { budget: 0, received: 0, expense: 0 });
  return (
    <PageShell title={String((client as any).name)} description={`${(client as any).contactPerson || "No contact person"} · ${(client as any).email || (client as any).phone || "No contact detail"}`} breadcrumb={[{ label: "Clients", href: "/clients" }, { label: String((client as any).name) }]} action={<Button asChild><Link href={`/clients/${routeParams.id}/edit`}>Edit Client</Link></Button>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Total Budget" value={totals.budget} currency />
        <StatCard label="Received" value={totals.received} currency />
        <StatCard label="Due" value={Math.max(totals.budget - totals.received, 0)} currency />
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
          <Info label="Code" value={(client as any).code} />
          <Info label="Status" value={(client as any).active ? "Active" : "Inactive"} />
          <Info label="Phone" value={(client as any).phone || "-"} />
          <Info label="Address" value={(client as any).address || "-"} />
          <div className="sm:col-span-2"><Info label="Notes" value={(client as any).notes || "-"} /></div>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Client Projects</h2>
        <DataTable data={projects} pagination={{ basePath: `/clients/${routeParams.id}`, searchParams: queryParams }} columns={[
          { header: "Project", cell: (project: any) => <Link className="font-medium hover:text-primary" href={`/projects/${project._id}`}>{project.name}</Link> },
          { header: "Code", cell: (project: any) => project.code },
          { header: "Budget", cell: (project: any) => money(project.totalBudget ?? 0) },
          { header: "Received", cell: (project: any) => money(project.received ?? 0) },
          { header: "Expense", cell: (project: any) => money(project.expense ?? 0) },
          { header: "Balance", cell: (project: any) => money((project.received ?? 0) - (project.expense ?? 0)) }
        ]} />
      </section>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
