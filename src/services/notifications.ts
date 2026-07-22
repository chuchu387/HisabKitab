import { actionButton, appUrl, emailLayout, escapeHtml, sendEmail } from "@/services/email";
import { money } from "@/lib/utils";
import { Notification } from "@/models/Notification";

type UserLike = {
  _id?: unknown;
  email?: string | null;
  name?: string | null;
};

type NotificationInput = {
  organizationId: string;
  userId: unknown;
  title: string;
  message: string;
  href: string;
  type?: string;
};

export async function createNotification(input: NotificationInput) {
  await Notification.create({
    organizationId: input.organizationId,
    userId: input.userId,
    title: input.title,
    message: input.message,
    href: input.href,
    type: input.type ?? "info"
  });
}

export async function notifyUserCreated(user: UserLike & { organizationId?: string; role?: string; password?: string }) {
  if (user.organizationId && user._id) {
    await createNotification({
      organizationId: user.organizationId,
      userId: user._id,
      title: "Your account is ready",
      message: `You were added to HisabKitab as ${user.role ?? "a user"}.`,
      href: "/dashboard",
      type: "user"
    }).catch(() => undefined);
  }
  if (!user.email) return;
  await sendEmail({
    to: [{ email: user.email, name: user.name }],
    subject: "Your HisabKitab account is ready",
    organizationId: user.organizationId ?? null,
    template: "user_created",
    entityType: "User",
    entityId: user._id?.toString?.(),
    html: emailLayout(
      "Your HisabKitab account is ready",
      `
        <p>Hello ${escapeHtml(user.name ?? "there")},</p>
        <p>An account has been created for you in HisabKitab.</p>
        <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Role:</strong> ${escapeHtml(user.role ?? "-")}</p>
        ${user.password ? `<p><strong>Temporary password:</strong> ${escapeHtml(user.password)}</p>` : ""}
        <p>Please sign in and keep your credentials secure.</p>
        ${actionButton("Open HisabKitab", appUrl("/login"))}
      `
    )
  });
}

export async function notifyTaskAssigned(user: UserLike & { organizationId?: string }, task: { title: string; status?: string; projectName?: string; taskUrl?: string }) {
  const href = task.taskUrl ?? appUrl("/tasks");
  if (user.organizationId && user._id) {
    await createNotification({
      organizationId: user.organizationId,
      userId: user._id,
      title: "Task assigned",
      message: `${task.title} ${task.projectName ? `in ${task.projectName}` : ""}`,
      href: toAppPath(href),
      type: "task"
    }).catch(() => undefined);
  }
  if (!user.email) return;
  await sendEmail({
    to: [{ email: user.email, name: user.name }],
    subject: `Task assigned: ${task.title}`,
    organizationId: user.organizationId ?? null,
    template: "task_assigned",
    entityType: "ProjectTask",
    html: emailLayout(
      "Task assigned to you",
      `
        <p>Hello ${escapeHtml(user.name ?? "there")},</p>
        <p>A task has been assigned to you.</p>
        <p><strong>Task:</strong> ${escapeHtml(task.title)}</p>
        <p><strong>Project:</strong> ${escapeHtml(task.projectName ?? "-")}</p>
        <p><strong>Status:</strong> ${escapeHtml(task.status ?? "-")}</p>
        ${actionButton("View Tasks", href)}
      `
    )
  });
}

export async function notifyExpenseApproval(user: UserLike & { organizationId?: string }, expense: { description?: string; amount?: number; approvalStatus: string; expenseUrl?: string }) {
  const href = expense.expenseUrl ?? appUrl("/expenses");
  if (user.organizationId && user._id) {
    await createNotification({
      organizationId: user.organizationId,
      userId: user._id,
      title: `Expense ${expense.approvalStatus}`,
      message: `${expense.description ?? "Expense"} for ${money(expense.amount ?? 0)}`,
      href: toAppPath(href),
      type: "expense"
    }).catch(() => undefined);
  }
  if (!user.email) return;
  await sendEmail({
    to: [{ email: user.email, name: user.name }],
    subject: `Expense ${expense.approvalStatus}: ${expense.description ?? "Expense"}`,
    organizationId: user.organizationId ?? null,
    template: "expense_approval",
    entityType: "Expense",
    html: emailLayout(
      `Expense ${expense.approvalStatus}`,
      `
        <p>Hello ${escapeHtml(user.name ?? "there")},</p>
        <p>Your expense approval status was updated.</p>
        <p><strong>Description:</strong> ${escapeHtml(expense.description ?? "-")}</p>
        <p><strong>Amount:</strong> ${money(expense.amount ?? 0)}</p>
        <p><strong>Status:</strong> ${escapeHtml(expense.approvalStatus)}</p>
        ${actionButton("View Expense", href)}
      `
    )
  });
}

export async function notifyExpenseSubmitted(recipients: Array<UserLike & { organizationId?: string }>, expense: { description?: string; amount?: number; submitterName?: string; expenseUrl?: string }) {
  const href = expense.expenseUrl ?? appUrl("/expenses");
  await Promise.all(recipients.map((recipient) => {
    if (!recipient.organizationId || !recipient._id) return Promise.resolve();
    return createNotification({
      organizationId: recipient.organizationId,
      userId: recipient._id,
      title: "Expense needs approval",
      message: `${expense.submitterName ?? "A user"} submitted ${money(expense.amount ?? 0)} for ${expense.description ?? "an expense"}.`,
      href: toAppPath(href),
      type: "expense"
    }).catch(() => undefined);
  }));
  const to = recipients.filter((recipient) => recipient.email).map((recipient) => ({ email: String(recipient.email), name: recipient.name }));
  if (!to.length) return;
  await sendEmail({
    to,
    subject: `Expense needs approval: ${expense.description ?? "Expense"}`,
    organizationId: recipients.find((recipient) => recipient.organizationId)?.organizationId ?? null,
    template: "expense_submitted",
    entityType: "Expense",
    html: emailLayout(
      "Expense needs approval",
      `
        <p>${escapeHtml(expense.submitterName ?? "A user")} submitted a new expense for approval.</p>
        <p><strong>Description:</strong> ${escapeHtml(expense.description ?? "-")}</p>
        <p><strong>Amount:</strong> ${money(expense.amount ?? 0)}</p>
        ${actionButton("Review Expense", href)}
      `
    )
  });
}

export async function notifyProjectPayment(recipients: Array<UserLike & { organizationId?: string }>, payment: { projectName?: string; amount: number; paymentUrl?: string }) {
  const href = payment.paymentUrl ?? appUrl("/project-payments");
  await Promise.all(recipients.map((recipient) => {
    if (!recipient.organizationId || !recipient._id) return Promise.resolve();
    return createNotification({
      organizationId: recipient.organizationId,
      userId: recipient._id,
      title: "Project payment received",
      message: `${payment.projectName ?? "Project"} received ${money(payment.amount)}`,
      href: toAppPath(href),
      type: "payment"
    }).catch(() => undefined);
  }));
  const to = recipients.filter((recipient) => recipient.email).map((recipient) => ({ email: String(recipient.email), name: recipient.name }));
  if (!to.length) return;
  await sendEmail({
    to,
    subject: `Project payment received: ${money(payment.amount)}`,
    organizationId: recipients.find((recipient) => recipient.organizationId)?.organizationId ?? null,
    template: "project_payment_received",
    entityType: "ProjectPayment",
    html: emailLayout(
      "Project payment received",
      `
        <p>A project payment was added in HisabKitab.</p>
        <p><strong>Project:</strong> ${escapeHtml(payment.projectName ?? "-")}</p>
        <p><strong>Amount:</strong> ${money(payment.amount)}</p>
        ${actionButton("View Payments", href)}
      `
    )
  });
}

function toAppPath(href: string) {
  try {
    const parsed = new URL(href);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return href || "/dashboard";
  }
}
