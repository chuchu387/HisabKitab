import { Attendance } from "@/models/Attendance";
import { EmailLog } from "@/models/EmailLog";
import { Organization } from "@/models/Organization";
import { User } from "@/models/User";
import { actionButton, appUrl, emailLayout, escapeHtml, sendEmail } from "@/services/email";

type AttendanceReminderOptions = {
  organizationId?: string;
  force?: boolean;
};

const selfTemplate = "attendance_missing_self";
const teamTemplate = "attendance_missing_team";
const timeZone = "Asia/Kathmandu";

export async function sendMissingAttendanceReminders(options: AttendanceReminderOptions = {}) {
  const now = new Date();
  const today = nepalDate(now);
  const currentHour = nepalHour(now);
  const startHour = numberEnv("ATTENDANCE_REMINDER_START_HOUR", 10);
  const endHour = numberEnv("ATTENDANCE_REMINDER_END_HOUR", 17);
  const maxPerDay = numberEnv("ATTENDANCE_REMINDER_MAX_PER_DAY", 8);

  if (!options.force && (currentHour < startHour || currentHour > endHour)) {
    return { date: today, skipped: true, reason: "outside_attendance_reminder_hours", checked: 0, reminded: 0, managerEmails: 0 };
  }

  const orgQuery: Record<string, unknown> = { status: "active" };
  if (options.organizationId) orgQuery._id = options.organizationId;
  const organizations = await Organization.find(orgQuery).select("_id name").lean() as any[];
  let checked = 0;
  let reminded = 0;
  let managerEmails = 0;

  for (const organization of organizations) {
    const organizationId = organization._id.toString();
    const [users, presentRecords] = await Promise.all([
      User.find({ organizationId, active: true, role: { $in: ["owner", "admin", "staff"] } }).select("_id name email role").lean(),
      Attendance.find({ organizationId, date: today }).select("userId").lean()
    ]);
    const typedUsers = users as any[];
    const typedPresentRecords = presentRecords as any[];
    const presentUserIds = new Set(typedPresentRecords.map((record) => record.userId?.toString()).filter(Boolean));
    const missingUsers = typedUsers.filter((user) => user.email && !presentUserIds.has(user._id.toString()));
    checked += typedUsers.length;

    const remindedUsers: any[] = [];
    for (const user of missingUsers) {
      const userId = user._id.toString();
      const sentToday = await EmailLog.countDocuments({
        organizationId,
        template: selfTemplate,
        entityType: "User",
        entityId: userId,
        status: "sent",
        "metadata.date": today
      });
      if (!options.force && sentToday >= maxPerDay) continue;

      const sentThisHour = await EmailLog.exists({
        organizationId,
        template: selfTemplate,
        entityType: "User",
        entityId: userId,
        "metadata.date": today,
        "metadata.hour": currentHour
      });
      if (!options.force && sentThisHour) continue;

      const attempt = sentToday + 1;
      const result = await sendEmail({
        organizationId,
        to: [{ email: user.email, name: user.name }],
        subject: `Attendance reminder ${attempt}/${maxPerDay}: please mark today's attendance`,
        template: selfTemplate,
        entityType: "User",
        entityId: userId,
        metadata: { date: today, hour: currentHour, attempt, maxPerDay },
        html: emailLayout(
          "Attendance reminder",
          `
            <p>Hi ${escapeHtml(user.name)}, your attendance for ${escapeHtml(today)} has not been marked yet.</p>
            <p>Please open HisabKitab and mark attendance as soon as possible.</p>
            <p style="color:#6b7280">Reminder ${attempt} of ${maxPerDay}. This reminder is sent once per hour while attendance is missing.</p>
            ${actionButton("Mark Attendance", appUrl("/attendance"))}
          `
        )
      });
      if (result.ok) {
        reminded += 1;
        remindedUsers.push({ ...user, attempt });
      }
    }

    if (remindedUsers.length) {
      const managers = typedUsers.filter((user) => ["owner", "admin"].includes(user.role) && user.email);
      if (managers.length) {
        const result = await sendEmail({
          organizationId,
          to: managers.map((user) => ({ email: user.email, name: user.name })),
          subject: `Missing attendance: ${remindedUsers.length} member${remindedUsers.length === 1 ? "" : "s"} need reminder`,
          template: teamTemplate,
          entityType: "Organization",
          entityId: organizationId,
          metadata: { date: today, hour: currentHour, missingUserIds: remindedUsers.map((user) => user._id.toString()) },
          html: emailLayout(
            "Missing attendance alert",
            `
              <p>The following team member${remindedUsers.length === 1 ? " has" : "s have"} not marked attendance for ${escapeHtml(today)}.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:12px">
                <thead><tr><th align="left" style="border-bottom:1px solid #e5e7eb;padding:8px">Member</th><th align="left" style="border-bottom:1px solid #e5e7eb;padding:8px">Role</th><th align="left" style="border-bottom:1px solid #e5e7eb;padding:8px">Reminder</th></tr></thead>
                <tbody>
                  ${remindedUsers.map((user) => `<tr><td style="border-bottom:1px solid #f3f4f6;padding:8px">${escapeHtml(user.name)}</td><td style="border-bottom:1px solid #f3f4f6;padding:8px">${escapeHtml(user.role)}</td><td style="border-bottom:1px solid #f3f4f6;padding:8px">${user.attempt}/${maxPerDay}</td></tr>`).join("")}
                </tbody>
              </table>
              ${actionButton("Open Attendance", appUrl("/attendance"))}
            `
          )
        });
        if (result.ok) managerEmails += managers.length;
      }
    }
  }

  return { date: today, checked, reminded, managerEmails, organizations: organizations.length };
}

function nepalDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function nepalHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(date);
  return Number(hour);
}

function numberEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}
