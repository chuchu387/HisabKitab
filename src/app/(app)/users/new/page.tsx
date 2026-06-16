import { PageShell } from "@/components/page-shell";
import { UserForm } from "@/features/forms/user-form";
import { requireRole } from "@/lib/permissions";

export default async function NewUserPage() {
  await requireRole(["owner"]);
  return <PageShell title="Create User" breadcrumb={[{ label: "Users", href: "/users" }, { label: "Create" }]}><UserForm /></PageShell>;
}
