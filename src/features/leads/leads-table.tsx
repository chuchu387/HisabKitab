"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteLeads, deleteLead } from "@/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable } from "@/components/data-table";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { leadSourceLabels, leadStatusColors, leadStatusLabels } from "@/constants";
import { formatDate, money, waLink } from "@/lib/utils";

export function LeadsTable({ leads, pagination }: { leads: any[]; pagination: any }) {
  const router = useRouter();
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isDeleting, startDelete] = useTransition();
  const allChecked = leads.length > 0 && checkedIds.length === leads.length;

  function toggleAll() {
    setCheckedIds(allChecked ? [] : leads.map((lead: any) => lead._id.toString()));
  }

  function toggle(id: string) {
    setCheckedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function deleteSelected() {
    startDelete(async () => {
      try {
        const result = await bulkDeleteLeads(checkedIds);
        toast.success(result.message);
        setCheckedIds([]);
        router.refresh();
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to delete leads");
      }
    });
  }

  const columns = [
    {
      header: "Select",
      cell: (lead: any) => (
        <input
          type="checkbox"
          checked={checkedIds.includes(lead._id.toString())}
          onChange={() => toggle(lead._id.toString())}
          className="h-4 w-4 rounded border-input accent-primary"
        />
      )
    },
    { header: "Name", cell: (lead: any) => <Link className="font-medium hover:text-primary" href={`/leads/${lead._id}`}>{lead.name}</Link> },
    { header: "Company", cell: (lead: any) => lead.company || "-" },
    { header: "Contact", cell: (lead: any) => <div>{lead.email ? <a href={`mailto:${lead.email}`} className="block text-primary hover:underline">{lead.email}</a> : null}{lead.phone ? <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a> : lead.email ? null : "-"}</div> },
    { header: "Source", cell: (lead: any) => <Badge variant="info">{leadSourceLabels[lead.source as keyof typeof leadSourceLabels] || lead.source}</Badge> },
    { header: "Project", cell: (lead: any) => lead.projectId ? <Link className="font-medium text-primary hover:underline" href={`/projects/${lead.projectId._id}`}>{lead.projectId.name}</Link> : "-" },
    { header: "Status", cell: (lead: any) => <Badge variant={(leadStatusColors[lead.status as keyof typeof leadStatusColors] || "default") as any}>{leadStatusLabels[lead.status as keyof typeof leadStatusLabels] || lead.status}</Badge> },
    { header: "Value", cell: (lead: any) => lead.estimatedValue ? money(lead.estimatedValue) : "-" },
    { header: "Assigned", cell: (lead: any) => lead.assignedTo?.name || "-" },
    { header: "Follow-up", cell: (lead: any) => lead.followUpDate ? formatDate(lead.followUpDate) : "-" },
    { header: "Actions", cell: (lead: any) => <div className="flex gap-2">
      {waLink(lead.phone) && <Button asChild variant="outline" size="sm" aria-label="WhatsApp"><a href={waLink(lead.phone, `Hello ${lead.name}`)} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="h-4 w-4" /></a></Button>}
      <Button asChild variant="outline" size="sm"><Link href={`/leads/${lead._id}/edit`}>Edit</Link></Button>
      <form action={deleteLead}><input type="hidden" name="id" value={lead._id.toString()} /><ConfirmButton label="Delete" /></form>
    </div> }
  ];

  return (
    <div className="space-y-3">
      {checkedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{checkedIds.length} lead{checkedIds.length === 1 ? "" : "s"} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={toggleAll}>{allChecked ? "Clear Selection" : "Select All"}</Button>
            <Button type="button" variant="outline" size="sm" disabled={isDeleting} onClick={deleteSelected}>
              <Trash2 className="h-4 w-4 text-destructive" />
              {isDeleting ? "Deleting..." : "Delete Selected"}
            </Button>
          </div>
        </div>
      )}
      {!checkedIds.length && (
        <div className="flex items-center justify-end">
          <Button type="button" variant="outline" size="sm" onClick={toggleAll}>Select All</Button>
        </div>
      )}
      <DataTable data={leads} pagination={pagination} columns={columns} />
    </div>
  );
}
