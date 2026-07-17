import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteProject } from "@/actions/projects";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { Expense } from "@/models/Expense";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";

export default async function ProjectsPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const params = await searchParams;
  const q = params?.q ?? "";
  const query: any = { organizationId: new Types.ObjectId(organizationId) };
  if (q) query.$or = [{ name: new RegExp(q, "i") }, { code: new RegExp(q, "i") }];
  const projects = await Project.aggregate([
    { $match: query },
    { $lookup: { from: ProjectPayment.collection.name, localField: "_id", foreignField: "projectId", as: "payments" } },
    { $lookup: { from: Expense.collection.name, localField: "_id", foreignField: "projectId", as: "expenses" } },
    { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "creator" } },
    {
      $addFields: {
        paidTotal: { $cond: [{ $gt: [{ $ifNull: ["$receivedAmount", 0] }, 0] }, { $ifNull: ["$receivedAmount", 0] }, { $sum: "$payments.amount" }] },
        expenseTotal: {
          $sum: {
            $map: {
              input: { $filter: { input: "$expenses", as: "expense", cond: { $eq: ["$$expense.approvalStatus", "approved"] } } },
              as: "expense",
              in: "$$expense.amount"
            }
          }
        }
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
  const canManage = ["owner", "admin"].includes(session.user.role);
  return (
    <PageShell title="Projects" action={canManage && <Button asChild><Link href="/projects/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex gap-2"><SearchBar placeholder="Search projects" defaultValue={q} /><Button variant="outline">Filter</Button></form>
      <DataTable data={projects} columns={[
        { header: "Name", cell: (p: any) => <Link className="font-medium hover:text-primary" href={`/projects/${p._id}`}>{p.name}</Link> },
        { header: "Code", cell: (p: any) => p.code },
        { header: "Type", cell: (p: any) => <Badge>{p.projectType === "internal" ? "Internal" : "Client"}</Badge> },
        { header: "Total Budget", cell: (p: any) => money(p.totalBudget) },
        { header: "Received", cell: (p: any) => money(p.paidTotal ?? 0) },
        { header: "Due", cell: (p: any) => money((p.totalBudget ?? 0) - (p.paidTotal ?? 0)) },
        { header: "Expense", cell: (p: any) => money(p.expenseTotal ?? 0) },
        { header: "Project Balance", cell: (p: any) => money((p.paidTotal ?? 0) - (p.expenseTotal ?? 0)) },
        { header: "Health", cell: (p: any) => <ProjectHealth project={p} /> },
        { header: "Created By", cell: (p: any) => p.creator?.[0]?.name ?? "Unknown" },
        { header: "Status", cell: (p: any) => <Badge variant={p.status === "active" ? "success" : p.status === "completed" ? "info" : "warning"}>{p.status}</Badge> },
        { header: "Actions", cell: (p: any) => canManage ? <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/projects/${p._id}/edit`}>Edit</Link></Button><form action={deleteProject}><input type="hidden" name="id" value={p._id.toString()} /><ConfirmButton /></form></div> : null }
      ]} />
    </PageShell>
  );
}

function ProjectHealth({ project }: { project: any }) {
  const received = project.paidTotal ?? 0;
  const expense = project.expenseTotal ?? 0;
  const budget = project.totalBudget ?? 0;
  const balance = received - expense;
  const receivedPercent = budget > 0 ? Math.min(100, Math.round((received / budget) * 100)) : 0;
  const spendPercent = received > 0 ? Math.min(100, Math.round((expense / received) * 100)) : expense > 0 ? 100 : 0;
  const label = project.projectType === "internal"
    ? expense > 0 ? "Funded by company cash" : "No spend"
    : balance < 0 ? "Overspent" : received < budget ? "Due" : "Healthy";
  const variant = balance < 0 ? "danger" : project.projectType === "internal" ? "info" : received < budget ? "warning" : "success";
  return (
    <div className="min-w-40 space-y-2">
      <Badge variant={variant as any}>{label}</Badge>
      <div className="space-y-1">
        <Progress label="Received" value={receivedPercent} />
        <Progress label="Spent" value={spendPercent} danger={spendPercent > 90} />
      </div>
    </div>
  );
}

function Progress({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{label}</span><span>{value}%</span></div>
      <div className="h-1.5 rounded-full bg-muted"><div className={danger ? "h-1.5 rounded-full bg-destructive" : "h-1.5 rounded-full bg-primary"} style={{ width: `${value}%` }} /></div>
    </div>
  );
}
