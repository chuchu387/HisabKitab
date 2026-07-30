"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Target, TrendingUp, Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCampaign } from "@/actions/campaigns";
import { money } from "@/lib/utils";

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
        {campaigns.map((c: any) => {
          const conversionPct = c.conversionRate || 0;
          const budgetUsed = c.budget > 0 ? Math.min(100, Math.round(((c.totalValue || 0) / c.budget) * 100)) : 0;
          const leadsPerWon = c.wonLeads > 0 ? Math.round((c.totalLeads || 0) / c.wonLeads) : 0;
          return (
            <Card key={c._id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <span className={`h-2 w-2 rounded-full ${c.active !== false ? "bg-primary" : "bg-muted-foreground"}`} title={c.active !== false ? "Active" : "Inactive"} />
                </div>
                {c.source && <p className="text-xs text-muted-foreground">{c.source}</p>}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <Users className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-lg font-semibold">{c.totalLeads}</p>
                    <p className="text-[10px] text-muted-foreground">Leads</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <TrendingUp className="mb-1 h-3.5 w-3.5 text-primary" />
                    <p className="text-lg font-semibold">{c.wonLeads}</p>
                    <p className="text-[10px] text-muted-foreground">Won</p>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Conversion</span>
                    <span className="font-medium text-primary">{conversionPct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(conversionPct, 100)}%` }} />
                  </div>
                </div>

                {c.budget > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Budget Used</span>
                      <span className="font-medium text-accent">{budgetUsed}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${budgetUsed}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span>Budget: {money(c.budget || 0)}</span>
                  {leadsPerWon > 0 && <span>~{leadsPerWon} leads/won</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!campaigns.length && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">No campaigns yet</div>
        )}
      </div>
    </div>
  );
}
