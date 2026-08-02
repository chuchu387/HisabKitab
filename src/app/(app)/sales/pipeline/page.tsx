import Link from "next/link";
import { Plus } from "lucide-react";
import { Types } from "mongoose";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Lead } from "@/models/Lead";
import { User } from "@/models/User";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";

export default async function PipelinePage() {
  const { organizationId } = await requireFeature("salesPipeline");
  await connectToDatabase();
  const oid = new Types.ObjectId(organizationId);
  const [leads, users] = await Promise.all([
    Lead.find({ organizationId: oid }).sort({ createdAt: -1 }).populate("assignedTo assignedToIds", "name").populate("projectId", "name code").populate("productId", "name category").lean() as any,
    User.find({ organizationId, active: true }).sort({ name: 1 }).select("name role").lean()
  ]);
  return (
    <PageShell title="Sales Pipeline" description="Drag leads through the sales stages to move them forward." action={<Button asChild><Link href="/leads/new"><Plus className="h-4 w-4" />New Lead</Link></Button>}>
      <PipelineBoard leads={JSON.parse(JSON.stringify(leads))} users={JSON.parse(JSON.stringify(users))} />
    </PageShell>
  );
}
