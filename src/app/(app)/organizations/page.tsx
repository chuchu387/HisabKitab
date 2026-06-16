import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deactivateOrganization } from "@/actions/organizations";
import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { Organization } from "@/models/Organization";

export default async function OrganizationsPage({ searchParams }: any) {
  await requireRole(["super_admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const q = params?.q ?? "";
  const query = q ? { $or: [{ name: new RegExp(q, "i") }, { code: new RegExp(q, "i") }] } : {};
  const organizations = await Organization.find(query).sort({ createdAt: -1 }).lean();
  return (
    <PageShell title="Organizations" action={<Button asChild><Link href="/organizations/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex gap-2"><SearchBar placeholder="Search organizations" defaultValue={q} /><Button variant="outline">Filter</Button></form>
      <DataTable data={organizations} columns={[
        { header: "Name", cell: (o: any) => o.name },
        { header: "Code", cell: (o: any) => o.code },
        { header: "Email", cell: (o: any) => o.email },
        { header: "Status", cell: (o: any) => <Badge>{o.status}</Badge> },
        { header: "Actions", cell: (o: any) => <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/organizations/${o._id}/edit`}>Edit</Link></Button><form action={deactivateOrganization}><input type="hidden" name="id" value={o._id.toString()} /><ConfirmButton label="Deactivate" /></form></div> }
      ]} />
    </PageShell>
  );
}
