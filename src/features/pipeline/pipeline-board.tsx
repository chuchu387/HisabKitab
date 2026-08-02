"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { UserRoundX, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { bulkAssignLeads, updateLeadStatus } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { leadSourceLabels, leadStatusLabels } from "@/constants";
import { cn, formatDate, money, waLink } from "@/lib/utils";

const stages = [
  { value: "new", color: "#2563eb", tint: "rgba(37, 99, 235, 0.08)" },
  { value: "contacted", color: "#ea580c", tint: "rgba(234, 88, 12, 0.09)" },
  { value: "meeting_scheduled", color: "#9333ea", tint: "rgba(147, 51, 234, 0.08)" },
  { value: "proposal_sent", color: "#0891b2", tint: "rgba(8, 145, 178, 0.08)" },
  { value: "negotiation", color: "#d97706", tint: "rgba(217, 119, 6, 0.08)" },
  { value: "won", color: "#16a34a", tint: "rgba(22, 163, 74, 0.08)" },
  { value: "lost", color: "#dc2626", tint: "rgba(220, 38, 38, 0.08)" }
] as const;

type Stage = (typeof stages)[number]["value"];

function getScoreColor(score: number) {
  if (score >= 70) return "text-primary";
  if (score >= 40) return "text-accent";
  return "text-muted-foreground";
}

function getScoreBg(score: number) {
  if (score >= 70) return "bg-primary/10";
  if (score >= 40) return "bg-accent/10";
  return "bg-muted/30";
}

function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function PipelineBoard({ leads, users }: { leads: any[]; users: any[] }) {
  const [items, setItems] = useState(leads);
  const [draggingId, setDraggingId] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [isMoving, startMove] = useTransition();
  const [isAssigning, startAssign] = useTransition();

  function onDrop(stage: Stage) {
    const lead = items.find((item) => item._id === draggingId);
    if (!lead || lead.status === stage) return;
    setItems((current) => current.map((item) => (item._id === lead._id ? { ...item, status: stage } : item)));
    startMove(async () => {
      try {
        await updateLeadStatus(lead._id, stage);
        toast.success("Lead moved");
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to move lead");
        setItems(leads);
      }
    });
  }

  function assignSelected(assigneeId: string) {
    if (!checkedIds.length) return;
    startAssign(async () => {
      try {
        const result = await bulkAssignLeads(checkedIds, assigneeId);
        const assignee = users.find((user) => user._id === assigneeId);
        setItems((current) => current.map((item) => checkedIds.includes(item._id) ? { ...item, assignedTo: assignee ?? null } : item));
        setCheckedIds([]);
        setShowAssign(false);
        toast.success(result.message);
      } catch (error: any) {
        toast.error(error?.message ?? "Failed to assign leads");
      }
    });
  }

  return (
    <div className="space-y-3">
      {checkedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{checkedIds.length} lead{checkedIds.length === 1 ? "" : "s"} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Button type="button" variant="default" size="sm" onClick={() => setShowAssign((value) => !value)}>
                <UsersRound className="h-4 w-4" />
                {isAssigning ? "Assigning..." : "Assign"}
              </Button>
              {showAssign && (
                <div className="absolute right-0 z-20 mt-2 max-h-64 w-56 overflow-y-auto rounded-lg border bg-card p-1.5 shadow-xl overscroll-contain">
                  <button type="button" className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-muted" onClick={() => { setCheckedIds([]); setShowAssign(false); }}>
                    <X className="h-4 w-4" /> Clear selection
                  </button>
                  {users.map((user) => (
                    <button key={user._id} type="button" className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-muted" onClick={() => assignSelected(user._id)}>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0 flex-1 truncate">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.role}</span>
                    </button>
                  ))}
                  <button type="button" className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted" onClick={() => assignSelected("")}>
                    <UserRoundX className="h-4 w-4" /> Unassign
                  </button>
                </div>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setCheckedIds([])}>Clear</Button>
          </div>
        </div>
      )}
      <div className="grid gap-3 overflow-x-auto pb-2 xl:grid-cols-7">
        {stages.map((stage) => {
          const columnLeads = items.filter((lead) => lead.status === stage.value);
          const total = columnLeads.reduce((sum, lead) => sum + (Number(lead.estimatedValue) || 0), 0);
          return (
            <div
              key={stage.value}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(stage.value)}
              className="flex max-h-[min(72vh,760px)] min-h-[300px] min-w-60 flex-col overflow-hidden rounded-lg border bg-card transition-opacity data-[moving=true]:opacity-75"
              data-moving={isMoving}
              style={{ borderTopColor: stage.color, boxShadow: `inset 0 3px 0 ${stage.color}` }}
            >
              <div className="flex items-center justify-between border-b p-3" style={{ backgroundColor: stage.tint }}>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  {leadStatusLabels[stage.value]}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">{columnLeads.length}</span>
                  {stage.value === "won" && total > 0 && <span className="text-xs font-semibold text-primary">{money(total)}</span>}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 overscroll-contain">
                {columnLeads.map((lead) => (
                  <PipelineCard
                    key={lead._id}
                    lead={lead}
                    stageColor={stage.color}
                    checked={checkedIds.includes(lead._id)}
                    onChecked={() => setCheckedIds((current) => current.includes(lead._id) ? current.filter((id) => id !== lead._id) : [...current, lead._id])}
                    onDragStart={() => setDraggingId(lead._id)}
                  />
                ))}
                {!columnLeads.length && <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Drop leads here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({ lead, stageColor, checked, onChecked, onDragStart }: { lead: any; stageColor: string; checked: boolean; onChecked: () => void; onDragStart: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn("w-full cursor-grab rounded-md border bg-background px-2.5 py-2 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing", checked && "border-primary ring-2 ring-primary/30")}
      style={{ borderLeftWidth: 5, borderLeftColor: stageColor }}
    >
      <div className="flex items-start justify-between gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <input type="checkbox" checked={checked} onChange={onChecked} className="h-3.5 w-3.5 shrink-0 rounded border-input accent-primary" />
          <Link href={`/leads/${lead._id}`} className="line-clamp-2 min-w-0 text-sm font-semibold hover:text-primary">{lead.name}</Link>
        </label>
        {lead.score > 0 && (
          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none", getScoreBg(lead.score), getScoreColor(lead.score))}>
            {lead.score}
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
        {lead.company && <span className="truncate">{lead.company}</span>}
        {lead.projectId?.name && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {lead.projectId.name}
          </span>
        )}
        {lead.productId?.name && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
            {lead.productId.name}
          </span>
        )}
        {lead.source && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            {leadSourceLabels[lead.source as keyof typeof leadSourceLabels] ?? lead.source}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold">{lead.estimatedValue > 0 ? money(lead.estimatedValue) : "No value"}</span>
        <span className="text-muted-foreground">{daysSince(lead.createdAt)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t pt-1.5 text-[10px] text-muted-foreground">
        <span className="truncate">{lead.assignedTo?.name ?? "Unassigned"}</span>
        <span className="flex shrink-0 items-center gap-2">
          {lead.followUpDate && <span>Follow: {formatDate(lead.followUpDate)}</span>}
          {waLink(lead.phone) && (
            <a href={waLink(lead.phone, `Hello ${lead.name}`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-5 w-5 items-center justify-center rounded text-primary transition-colors hover:bg-secondary" aria-label="WhatsApp">
              <WhatsAppIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </span>
      </div>
    </div>
  );
}
