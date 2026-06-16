import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { UserForm } from "@/features/forms/user-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { User } from "@/models/User";

export default async function EditUserPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner"]);
  await connectToDatabase();
  const user = await User.findOne({ _id: params.id, organizationId }).lean();
  if (!user) notFound();
  return <PageShell title="Edit User" breadcrumb={[{ label: "Users", href: "/users" }, { label: "Edit" }]}><UserForm user={JSON.parse(JSON.stringify(user))} /></PageShell>;
}
