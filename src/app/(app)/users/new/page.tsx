import { PageShell } from "@/components/page-shell";
import { UserForm } from "@/features/forms/user-form";
import { requireFeature } from "@/lib/permissions";
 
export default async function NewUserPage() {
  await requireFeature("usersManage");
  return <PageShell title="Create User" breadcrumb={[{ label: "Users", href: "/users" }, { label: "Create" }]}><UserForm /></PageShell>;
}
