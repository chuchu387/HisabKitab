import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ProjectForm } from "@/features/forms/project-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Project } from "@/models/Project";

export default async function EditProjectPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const project = await Project.findOne({ _id: params.id, organizationId }).lean();
  if (!project) notFound();
  return <PageShell title="Edit Project" breadcrumb={[{ label: "Projects", href: "/projects" }, { label: "Edit" }]}><ProjectForm project={JSON.parse(JSON.stringify(project))} /></PageShell>;
}
