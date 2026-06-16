import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { CategoryForm } from "@/features/forms/category-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { ExpenseCategory } from "@/models/ExpenseCategory";

export default async function EditCategoryPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const category = await ExpenseCategory.findOne({ _id: params.id, organizationId }).lean();
  if (!category) notFound();
  return <PageShell title="Edit Category" breadcrumb={[{ label: "Categories", href: "/categories" }, { label: "Edit" }]}><CategoryForm category={JSON.parse(JSON.stringify(category))} /></PageShell>;
}
