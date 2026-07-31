import { PageShell } from "@/components/page-shell";
import { CategoryForm } from "@/features/forms/category-form";
import { requireFeature } from "@/lib/permissions";

export default async function NewCategoryPage() {
  await requireFeature("expensesManage");
  return <PageShell title="Create Category" breadcrumb={[{ label: "Categories", href: "/categories" }, { label: "Create" }]}><CategoryForm /></PageShell>;
}
