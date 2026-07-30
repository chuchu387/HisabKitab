"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCampaign } from "@/actions/campaigns";

export function CampaignList({ campaigns }: { campaigns: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const res = await saveCampaign(fd);
    if (!res.ok) { toast.error(res.message); setSubmitting(false); return; }
    toast.success(res.message);
    setShowForm(false);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!showForm && <Button onClick={() => setShowForm(true)} variant="outline" size="sm"><Plus className="h-4 w-4" /> Add Campaign</Button>}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Add Campaign</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input id="source" name="source" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input id="budget" name="budget" type="number" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c: any) => (
          <Card key={c._id}>
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {c.source && <p><span className="text-muted-foreground">Source:</span> {c.source}</p>}
              <p><span className="text-muted-foreground">Budget:</span> Rs. {Number(c.budget || 0).toLocaleString()}</p>
              <p><span className="text-muted-foreground">Total Leads:</span> {c.totalLeads}</p>
              <p><span className="text-muted-foreground">Won:</span> {c.wonLeads}</p>
              <p><span className="text-muted-foreground">Conversion:</span> {c.conversionRate}%</p>
              <p><span className="text-muted-foreground">Total Value:</span> Rs. {Number(c.totalValue || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {!campaigns.length && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">No campaigns yet</div>
        )}
      </div>
    </div>
  );
}
