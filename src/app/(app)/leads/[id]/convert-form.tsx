"use client";

import { useState } from "react";
import { toast } from "sonner";
import { convertLeadToClient } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function ConvertForm({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const defaultCode = leadName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("leadId", leadId);
    const result = await convertLeadToClient(formData);
    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      setPending(false);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-2">
        <Label htmlFor="clientCode">Client Code</Label>
        <Input id="clientCode" name="clientCode" defaultValue={defaultCode} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name (optional)</Label>
        <Input id="projectName" name="projectName" placeholder="e.g. Website Development" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectCode">Project Code (optional)</Label>
        <Input id="projectCode" name="projectCode" placeholder="e.g. WEB-001" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="budget">Budget (optional)</Label>
        <Input id="budget" name="budget" type="number" min="0" step="0.01" placeholder="0" />
      </div>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <Button type="submit" disabled={pending} className="sm:col-span-2">{pending ? "Converting..." : "Convert to Client"}</Button>
    </form>
  );
}
