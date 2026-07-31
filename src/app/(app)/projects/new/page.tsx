import { PageShell } from "@/components/page-shell";
import { ProjectForm } from "@/features/forms/project-form";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Client } from "@/models/Client";

export default async function NewProjectPage() {
  const { organizationId } = await requireFeature("projectsView");
  await connectToDatabase();
  const clients = await Client.find({ organizationId, active: true }).sort({ name: 1 }).select("name code").lean();
  return <PageShell title="Create Project" breadcrumb={[{ label: "Projects", href: "/projects" }, { label: "Create" }]}><ProjectForm clients={JSON.parse(JSON.stringify(clients))} /></PageShell>;
}
