import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageShell } from "@/components/page-shell";
import { SearchBar } from "@/components/search-bar";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteCategory } from "@/actions/categories";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { ExpenseCategory } from "@/models/ExpenseCategory";

export default async function CategoriesPage({ searchParams }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const q = searchParams?.q ?? "";
  const query: any = { organizationId };
  if (q) query.name = new RegExp(q, "i");
  const categories = await ExpenseCategory.find(query).sort({ name: 1 }).lean();
  return (
    <PageShell title="Categories" action={<Button asChild><Link href="/categories/new"><Plus className="h-4 w-4" />Create</Link></Button>}>
      <form className="flex gap-2"><SearchBar placeholder="Search categories" defaultValue={q} /><Button variant="outline">Filter</Button></form>
      <DataTable data={categories} columns={[
        { header: "Name", cell: (c: any) => c.name },
        { header: "Description", cell: (c: any) => c.description || "-" },
        { header: "Status", cell: (c: any) => <Badge>{c.active ? "Active" : "Inactive"}</Badge> },
        { header: "Actions", cell: (c: any) => <div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/categories/${c._id}/edit`}>Edit</Link></Button><form action={deleteCategory}><input type="hidden" name="id" value={c._id.toString()} /><ConfirmButton /></form></div> }
      ]} />
    </PageShell>
  );
}
