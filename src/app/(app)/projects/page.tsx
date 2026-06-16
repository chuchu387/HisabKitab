import Link from "next/link";
import { Plus } from "lucide-react";
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
import { Project } from "@/models/Project";

export default async function ProjectsPage({ searchParams }: any) {
  const { organizationId, session } = await requireTenant();
  await connectToDatabase();
  const q = searchParams?.q ?? "";
  const query: any = { organizationId };
  if (q) query.$or = [{ name: new RegExp(q, "i") }, { code: new RegExp(q, "i") }];
  const projects = await Project.find(query).sort({ createdAt: -1 }).lean();
  const canManage = ["owner", "admin"].includes(session.user.role);
  return (
    <PageShell title="Projects" action={canManage && <Button asChild><Link href="/projects/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex gap-2"><SearchBar placeholder="Search projects" defaultValue={q} /><Button variant="outline">Filter</Button></form>
      <DataTable data={projects} columns={[
        { header: "Name", cell: (p: any) => <Link className="font-medium hover:text-primary" href={`/projects/${p._id}`}>{p.name}</Link> },
        { header: "Code", cell: (p: any) => p.code },
        { header: "Budget", cell: (p: any) => money(p.totalBudget) },
        { header: "Status", cell: (p: any) => <Badge>{p.status}</Badge> },
        { header: "Actions", cell: (p: any) => canManage ? <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/projects/${p._id}/edit`}>Edit</Link></Button><form action={deleteProject}><input type="hidden" name="id" value={p._id.toString()} /><ConfirmButton /></form></div> : null }
      ]} />
    </PageShell>
  );
}
