import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ProjectForm } from "@/features/forms/project-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";
import { Project } from "@/models/Project";

export default async function EditProjectPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const routeParams = await params;
  const [project, clients] = await Promise.all([
    Project.findOne({ _id: routeParams.id, organizationId }).lean(),
    Client.find({ organizationId, active: true }).sort({ name: 1 }).select("name code").lean()
  ]);
  if (!project) notFound();
  return <PageShell title="Edit Project" breadcrumb={[{ label: "Projects", href: "/projects" }, { label: "Edit" }]}><ProjectForm project={JSON.parse(JSON.stringify(project))} clients={JSON.parse(JSON.stringify(clients))} /></PageShell>;
}
