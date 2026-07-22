import { Types } from "mongoose";
import { differenceInCalendarDays, startOfDay, subHours } from "date-fns";
import { Client } from "@/models/Client";
import { EmailLog } from "@/models/EmailLog";
import { Project } from "@/models/Project";
import { ProjectPayment } from "@/models/ProjectPayment";
import { User } from "@/models/User";
import { appUrl, emailLayout, actionButton, escapeHtml, sendEmail } from "@/services/email";
import { createNotification } from "@/services/notifications";
import { money } from "@/lib/utils";

export type PaymentReminderResult = {
  projectId: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  due: number;
  reason: string;
  status: "sent" | "skipped" | "failed";
  message: string;
};

type ReminderOptions = {
  organizationId?: string;
  triggeredBy?: string;
  minDaysSincePayment?: number;
  dueSoonDays?: number;
  force?: boolean;
};

export async function sendPaymentDueReminders({
  organizationId,
  triggeredBy,
  minDaysSincePayment = 7,
  dueSoonDays = 7,
  force = false
}: ReminderOptions) {
  const organizationFilter = organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {};
  const projects = await Project.find({
    ...organizationFilter,
    projectType: "client",
    totalBudget: { $gt: 0 },
    status: { $in: ["active", "on_hold", "completed"] }
  }).populate({ path: "clientId", model: Client, select: "name email contactPerson" }).sort({ endDate: 1 }).lean();

  const results: PaymentReminderResult[] = [];
  for (const project of projects as any[]) {
    const due = roundMoney((project.totalBudget ?? 0) - (project.receivedAmount ?? 0));
    if (due <= 0) continue;

    const lastPayment = await ProjectPayment.findOne({ organizationId: project.organizationId, projectId: project._id }).sort({ paymentDate: -1 }).select("paymentDate").lean() as any;
    const today = startOfDay(new Date());
    const lastPaymentDate = lastPayment?.paymentDate ? new Date(lastPayment.paymentDate) : new Date(project.startDate ?? project.createdAt);
    const daysSincePayment = differenceInCalendarDays(today, startOfDay(lastPaymentDate));
    const daysUntilEnd = differenceInCalendarDays(startOfDay(new Date(project.endDate)), today);
    const reason = reminderReason(daysSincePayment, daysUntilEnd, minDaysSincePayment, dueSoonDays);
    if (!force && !reason) continue;

    const duplicate = force ? 0 : await EmailLog.countDocuments({
      organizationId: project.organizationId,
      template: "payment_due_reminder",
      entityType: "Project",
      entityId: project._id.toString(),
      status: "sent",
      createdAt: { $gte: subHours(new Date(), 24) }
    });
    if (duplicate) {
      results.push(formatResult(project, due, reason || "Already reminded", "skipped", "Already sent in the last 24 hours"));
      continue;
    }

    const client = project.clientId;
    const projectUrl = appUrl(`/projects/${project._id}`);
    const emailResult = await sendEmail({
      to: client?.email ? [{ email: client.email, name: client.contactPerson || client.name }] : [],
      subject: `Payment reminder: ${project.name}`,
      organizationId: project.organizationId?.toString?.(),
      template: "payment_due_reminder",
      entityType: "Project",
      entityId: project._id.toString(),
      metadata: { due, projectCode: project.code, triggeredBy, reason },
      html: emailLayout(
        "Payment reminder",
        `
          <p>Hello ${escapeHtml(client?.contactPerson || client?.name || "there")},</p>
          <p>This is a payment reminder for your project with HisabKitab.</p>
          <p><strong>Project:</strong> ${escapeHtml(project.name)} (${escapeHtml(project.code)})</p>
          <p><strong>Total Budget:</strong> ${money(project.totalBudget ?? 0)}</p>
          <p><strong>Received:</strong> ${money(project.receivedAmount ?? 0)}</p>
          <p><strong>Due:</strong> ${money(due)}</p>
          <p><strong>Project End Date:</strong> ${new Date(project.endDate).toISOString().slice(0, 10)}</p>
          ${actionButton("View Project", projectUrl)}
        `
      )
    });

    if (emailResult.ok) await notifyAdmins(project, due, client?.name ?? "Client");
    results.push(formatResult(project, due, reason || "Manual reminder", emailResult.ok ? "sent" : "failed", emailResult.ok ? "Reminder sent" : "Email provider did not accept the reminder"));
  }

  return {
    scanned: projects.length,
    sent: results.filter((result) => result.status === "sent").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results
  };
}

function reminderReason(daysSincePayment: number, daysUntilEnd: number, minDaysSincePayment: number, dueSoonDays: number) {
  if (daysUntilEnd < 0) return `Project ended ${Math.abs(daysUntilEnd)} days ago`;
  if (daysUntilEnd <= dueSoonDays) return `Project ends in ${daysUntilEnd} days`;
  if (daysSincePayment >= minDaysSincePayment) return `No payment in ${daysSincePayment} days`;
  return "";
}

function formatResult(project: any, due: number, reason: string, status: PaymentReminderResult["status"], message: string): PaymentReminderResult {
  return {
    projectId: project._id.toString(),
    projectName: project.name,
    clientName: project.clientId?.name ?? "No Client",
    clientEmail: project.clientId?.email ?? "",
    due,
    reason,
    status,
    message
  };
}

async function notifyAdmins(project: any, due: number, clientName: string) {
  const admins = await User.find({ organizationId: project.organizationId, active: true, role: { $in: ["owner", "admin"] } }).select("_id name email").lean();
  await Promise.all((admins as any[]).map((admin) => createNotification({
    organizationId: project.organizationId.toString(),
    userId: admin._id,
    title: "Payment reminder sent",
    message: `${clientName} was reminded about ${money(due)} due for ${project.name}.`,
    href: `/projects/${project._id}`,
    type: "payment"
  }).catch(() => undefined)));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
