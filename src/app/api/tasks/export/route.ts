import Papa from "papaparse";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { safeObjectId } from "@/lib/utils";
import { Project } from "@/models/Project";
import { ProjectTask } from "@/models/ProjectTask";
import { User } from "@/models/User";

void Project;
void User;

export async function GET(request: NextRequest) {
  const { organizationId } = await requireTenant();
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "sla" ? "sla" : "time";
  const format = searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const tasks = await ProjectTask.find(taskQuery(searchParams, organizationId))
    .populate("projectId assigneeId assigneeIds createdBy")
    .sort({ createdAt: -1 })
    .lean() as any[];
  const rows = type === "sla" ? slaRows(tasks) : timeRows(tasks);

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([842, 595]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText(type === "sla" ? "Task SLA Report" : "Task Time Report", { x: 36, y: 548, font: bold, size: 18, color: rgb(0.06, 0.46, 0.43) });
    page.drawText(`Generated: ${new Date().toLocaleString()}`, { x: 36, y: 528, font, size: 9, color: rgb(0.35, 0.35, 0.35) });
    const headers = Object.keys(rows[0] ?? (type === "sla" ? { task: "", project: "", assignees: "", status: "", estimate: "", actual: "", extra: "" } : { group: "", name: "", tasks: "", tracked: "", extra: "" }));
    drawRow(page, bold, headers, 36, 500);
    rows.slice(0, 28).forEach((row, index) => drawRow(page, font, headers.map((header) => String((row as any)[header] ?? "")), 36, 478 - index * 15));
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=task-${type}-report.pdf` } });
  }

  const csv = Papa.unparse(rows as Array<Record<string, unknown>>);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=task-${type}-report.csv` } });
}

function taskQuery(searchParams: URLSearchParams, organizationId: string) {
  const query: any = { organizationId };
  const q = searchParams.get("q");
  if (q) query.$or = [{ title: new RegExp(q, "i") }, { description: new RegExp(q, "i") }];
  if (searchParams.get("status")) query.status = searchParams.get("status");
  if (searchParams.get("priority")) query.priority = searchParams.get("priority");
  if (searchParams.get("severity")) query.severity = searchParams.get("severity");
  if (searchParams.get("milestone")) query.milestone = new RegExp(String(searchParams.get("milestone")), "i");
  if (searchParams.get("projectId")) {
    const projectId = safeObjectId(searchParams.get("projectId"));
    if (projectId) query.projectId = projectId;
  }
  if (searchParams.get("folderId")) {
    const folderId = safeObjectId(searchParams.get("folderId"));
    if (folderId) query.folderId = folderId;
  }
  if (searchParams.get("assigneeId")) {
    const assigneeId = safeObjectId(searchParams.get("assigneeId"));
    if (assigneeId) query.$and = [{ $or: [{ assigneeId }, { assigneeIds: assigneeId }] }];
  }
  if (searchParams.get("due")) {
    const today = new Date();
    const start = new Date(today.toDateString());
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    if (searchParams.get("due") === "overdue") query.dueDate = { $lt: today };
    if (searchParams.get("due") === "today") query.dueDate = { $gte: start, $lte: end };
    if (searchParams.get("due") === "upcoming") query.dueDate = { $gt: end };
  }
  return query;
}

function timeRows(tasks: any[]) {
  const rows = new Map<string, { group: string; name: string; tasks: number; tracked: string; extra: string; seconds: number; extraSeconds: number }>();
  for (const task of tasks) {
    const seconds = elapsedForTask(task);
    const extraSeconds = overrunSeconds(task, seconds);
    for (const assignee of taskAssignees(task)) {
      addRow(rows, `staff:${assignee.name}`, "Staff", assignee.name, seconds, extraSeconds);
    }
    addRow(rows, `project:${task.projectId?._id ?? task.projectId}`, "Project", task.projectId?.name ?? "Project", seconds, extraSeconds);
  }
  return [...rows.values()].sort((a, b) => b.seconds - a.seconds).map(({ seconds, extraSeconds, ...row }) => row);
}

function slaRows(tasks: any[]) {
  return tasks
    .map((task) => ({ task, elapsed: elapsedForTask(task), extraSeconds: overrunSeconds(task) }))
    .filter((row) => row.extraSeconds > 0)
    .sort((a, b) => b.extraSeconds - a.extraSeconds)
    .map(({ task, elapsed, extraSeconds }) => ({
      task: task.title,
      project: task.projectId?.name ?? "Project",
      assignees: taskAssignees(task).map((user: { name: string }) => user.name).join(", ") || "Unassigned",
      status: statusLabel(task.status),
      estimate: `${Number(task.estimatedHours ?? 0)}h`,
      actual: formatDuration(elapsed),
      extra: formatDuration(extraSeconds)
    }));
}

function addRow(rows: Map<string, any>, key: string, group: string, name: string, seconds: number, extraSeconds: number) {
  const current = rows.get(key) ?? { group, name, tasks: 0, seconds: 0, extraSeconds: 0 };
  current.tasks += 1;
  current.seconds += seconds;
  current.extraSeconds += extraSeconds;
  current.tracked = formatDuration(current.seconds);
  current.extra = current.extraSeconds > 0 ? formatDuration(current.extraSeconds) : "-";
  rows.set(key, current);
}

function drawRow(page: any, font: any, cells: string[], x: number, y: number) {
  const widths = [90, 180, 170, 75, 75, 75, 75];
  let left = x;
  cells.forEach((cell, index) => {
    page.drawText(String(cell).slice(0, index === 1 || index === 2 ? 34 : 16), { x: left, y, font, size: 8 });
    left += widths[index] ?? 90;
  });
}

function taskAssignees(task: any) {
  const multi = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
  if (multi.length) return multi.map((user: any) => ({ name: user?.name ?? "User" }));
  return task.assigneeId ? [{ name: task.assigneeId?.name ?? "User" }] : [{ name: "Unassigned" }];
}

function elapsedForTask(task: any) {
  return Number(task.accumulatedSeconds ?? 0) + (task.timerStatus === "running" ? secondsSince(task.lastTimerStartedAt) : 0);
}

function overrunSeconds(task: any, elapsed = elapsedForTask(task)) {
  const estimateSeconds = Number(task.estimatedHours ?? 0) * 3600;
  if (!estimateSeconds) return 0;
  return Math.max(0, elapsed - estimateSeconds);
}

function secondsSince(value: string | Date | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 1000));
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
}

function statusLabel(value: string) {
  return value === "to_do" ? "To Do" : value === "in_progress" ? "In Progress" : value === "in_review" ? "In Review" : value === "complete" ? "Complete" : value;
}
