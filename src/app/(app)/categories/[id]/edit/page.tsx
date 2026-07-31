import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { CategoryForm } from "@/features/forms/category-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { ExpenseCategory } from "@/models/ExpenseCategory";

export default async function EditCategoryPage({ params }: any) {
  const { organizationId } = await requireFeature("expensesManage");
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const category = await ExpenseCategory.findOne({ _id: routeParams.id, organizationId }).lean();
  if (!category) notFound();
  return <PageShell title="Edit Category" breadcrumb={[{ label: "Categories", href: "/categories" }, { label: "Edit" }]}><CategoryForm category={JSON.parse(JSON.stringify(category))} /></PageShell>;
}
