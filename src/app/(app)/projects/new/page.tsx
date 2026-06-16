import { PageShell } from "@/components/page-shell";
import { ProjectForm } from "@/features/forms/project-form";
import { requireRole } from "@/lib/permissions";

export default async function NewProjectPage() {
  await requireRole(["owner", "admin"]);
  return <PageShell title="Create Project" breadcrumb={[{ label: "Projects", href: "/projects" }, { label: "Create" }]}><ProjectForm /></PageShell>;
}
