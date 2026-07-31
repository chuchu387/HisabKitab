import { PageShell } from "@/components/page-shell";
import { ClientForm } from "@/features/forms/client-form";
import { requireFeature } from "@/lib/permissions";

export default async function NewClientPage() {
  await requireFeature("clientsManage");
  return <PageShell title="Create Client" breadcrumb={[{ label: "Clients", href: "/clients" }, { label: "Create" }]}><ClientForm /></PageShell>;
}
