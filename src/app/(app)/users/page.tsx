import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { disableUser } from "@/actions/users";
import { roleLabels } from "@/constants";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { User } from "@/models/User";

void User;

export default async function UsersPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const params = await searchParams;
  const q = params?.q ?? "";
  const role = params?.role ?? "";
  const query: any = { organizationId };
  if (q) query.$or = [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];
  if (role) query.role = role;
  const users = await User.find(query).populate("createdBy").sort({ createdAt: -1 }).lean();
  return (
    <PageShell title="Users" action={<Button asChild><Link href="/users/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="filter-bar">
        <SearchBar placeholder="Search users" defaultValue={q} />
        <select name="role" defaultValue={role} className="native-control">
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <DataTable data={users} pagination={{ basePath: "/users", searchParams: params }} columns={[
        { header: "Name", cell: (u: any) => u.name },
        { header: "Email", cell: (u: any) => u.email },
        { header: "Role", cell: (u: any) => roleLabels[u.role as keyof typeof roleLabels] },
        { header: "Added By", cell: (u: any) => u.createdBy?.name ?? "Unknown" },
        { header: "Status", cell: (u: any) => <Badge>{u.active ? "Active" : "Disabled"}</Badge> },
        { header: "Actions", cell: (u: any) => <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/users/${u._id}/edit`}>Edit</Link></Button><form action={disableUser}><input type="hidden" name="id" value={u._id.toString()} /><ConfirmButton label="Disable" /></form></div> }
      ]} />
    </PageShell>
  );
}
