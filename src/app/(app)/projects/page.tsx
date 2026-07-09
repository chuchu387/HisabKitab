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
        paidTotal: { $cond: [{ $gt: [{ $size: "$payments" }, 0] }, { $sum: "$payments.amount" }, { $ifNull: ["$receivedAmount", 0] }] },
        expenseTotal: {
          $sum: {
            $map: {
              input: { $filter: { input: "$expenses", as: "expense", cond: { $or: [{ $eq: ["$$expense.approvalStatus", "approved"] }, { $eq: [{ $type: "$$expense.approvalStatus" }, "missing"] }] } } },
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
        { header: "Total Budget", cell: (p: any) => money(p.totalBudget) },
        { header: "Total Paid", cell: (p: any) => money(p.paidTotal ?? 0) },
        { header: "Due", cell: (p: any) => money((p.totalBudget ?? 0) - (p.paidTotal ?? 0)) },
        { header: "Expense", cell: (p: any) => money(p.expenseTotal ?? 0) },
        { header: "Paid Balance", cell: (p: any) => money((p.paidTotal ?? 0) - (p.expenseTotal ?? 0)) },
        { header: "Created By", cell: (p: any) => p.creator?.[0]?.name ?? "Unknown" },
        { header: "Status", cell: (p: any) => <Badge>{p.status}</Badge> },
        { header: "Actions", cell: (p: any) => canManage ? <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/projects/${p._id}/edit`}>Edit</Link></Button><form action={deleteProject}><input type="hidden" name="id" value={p._id.toString()} /><ConfirmButton /></form></div> : null }
      ]} />
    </PageShell>
  );
}
