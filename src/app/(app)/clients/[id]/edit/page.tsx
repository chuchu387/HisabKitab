import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ClientForm } from "@/features/forms/client-form";
import { connectToDatabase } from "@/lib/db";
import { requireRole, requireTenant } from "@/lib/permissions";
import { Client } from "@/models/Client";

export default async function EditClientPage({ params }: any) {
  const { organizationId } = await requireTenant();
  await requireRole(["owner", "admin"]);
  await connectToDatabase();
  const routeParams = await params;
  const client = await Client.findOne({ _id: routeParams.id, organizationId }).lean();
  if (!client) notFound();
  return <PageShell title="Edit Client" breadcrumb={[{ label: "Clients", href: "/clients" }, { label: "Edit" }]}><ClientForm client={JSON.parse(JSON.stringify(client))} /></PageShell>;
}
