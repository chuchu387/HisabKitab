import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { deactivateClient } from "@/actions/clients";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";

export default async function ClientsPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const params = await searchParams;
  const q = params?.q ?? "";
  const query: any = { organizationId };
  if (q) query.$or = [{ name: new RegExp(q, "i") }, { code: new RegExp(q, "i") }, { contactPerson: new RegExp(q, "i") }];
  const clients = await Client.find(query).sort({ name: 1 }).lean();
  return (
    <PageShell title="Clients" description="Manage client profiles, contacts, and project relationships." action={<Button asChild><Link href="/clients/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="filter-bar"><SearchBar placeholder="Search clients" defaultValue={q} /><Button variant="outline">Filter</Button></form>
      <DataTable data={clients} pagination={{ basePath: "/clients", searchParams: params }} columns={[
        { header: "Client", cell: (client: any) => <Link className="font-medium hover:text-primary" href={`/clients/${client._id}`}>{client.name}</Link> },
        { header: "Code", cell: (client: any) => client.code },
        { header: "Contact", cell: (client: any) => <div><p>{client.contactPerson || "-"}</p><p className="text-xs text-muted-foreground">{client.email || client.phone || "-"}</p></div> },
        { header: "Status", cell: (client: any) => <Badge variant={client.active ? "success" : "muted"}>{client.active ? "Active" : "Inactive"}</Badge> },
        { header: "Actions", cell: (client: any) => <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/clients/${client._id}/edit`}>Edit</Link></Button><form action={deactivateClient}><input type="hidden" name="id" value={client._id.toString()} /><ConfirmButton label="Deactivate" /></form></div> }
      ]} />
    </PageShell>
  );
}
