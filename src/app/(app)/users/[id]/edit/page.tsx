import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { UserForm } from "@/features/forms/user-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { isObjectId } from "@/lib/utils";
import { User } from "@/models/User";

export default async function EditUserPage({ params }: any) {
  const { organizationId } = await requireFeature("usersManage");
  await connectToDatabase();
  const routeParams = await params;
  if (!isObjectId(routeParams.id)) notFound();
  const user = await User.findOne({ _id: routeParams.id, organizationId }).lean();
  if (!user) notFound();
  return <PageShell title="Edit User" breadcrumb={[{ label: "Users", href: "/users" }, { label: "Edit" }]}><UserForm user={JSON.parse(JSON.stringify(user))} /></PageShell>;
}
