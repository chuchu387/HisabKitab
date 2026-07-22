import { actionButton, appUrl, emailLayout, escapeHtml, sendEmail } from "@/services/email";
import { money } from "@/lib/utils";

type UserLike = {
  email?: string | null;
  name?: string | null;
};

export async function notifyUserCreated(user: UserLike & { role?: string; password?: string }) {
  if (!user.email) return;
  await sendEmail({
    to: [{ email: user.email, name: user.name }],
    subject: "Your HisabKitab account is ready",
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

export async function notifyTaskAssigned(user: UserLike, task: { title: string; status?: string; projectName?: string; taskUrl?: string }) {
  if (!user.email) return;
  await sendEmail({
    to: [{ email: user.email, name: user.name }],
    subject: `Task assigned: ${task.title}`,
    html: emailLayout(
      "Task assigned to you",
      `
        <p>Hello ${escapeHtml(user.name ?? "there")},</p>
        <p>A task has been assigned to you.</p>
        <p><strong>Task:</strong> ${escapeHtml(task.title)}</p>
        <p><strong>Project:</strong> ${escapeHtml(task.projectName ?? "-")}</p>
        <p><strong>Status:</strong> ${escapeHtml(task.status ?? "-")}</p>
        ${actionButton("View Tasks", task.taskUrl ?? appUrl("/tasks"))}
      `
    )
  });
}

export async function notifyExpenseApproval(user: UserLike, expense: { description?: string; amount?: number; approvalStatus: string; expenseUrl?: string }) {
  if (!user.email) return;
  await sendEmail({
    to: [{ email: user.email, name: user.name }],
    subject: `Expense ${expense.approvalStatus}: ${expense.description ?? "Expense"}`,
    html: emailLayout(
      `Expense ${expense.approvalStatus}`,
      `
        <p>Hello ${escapeHtml(user.name ?? "there")},</p>
        <p>Your expense approval status was updated.</p>
        <p><strong>Description:</strong> ${escapeHtml(expense.description ?? "-")}</p>
        <p><strong>Amount:</strong> ${money(expense.amount ?? 0)}</p>
        <p><strong>Status:</strong> ${escapeHtml(expense.approvalStatus)}</p>
        ${actionButton("View Expense", expense.expenseUrl ?? appUrl("/expenses"))}
      `
    )
  });
}

export async function notifyProjectPayment(recipients: UserLike[], payment: { projectName?: string; amount: number; paymentUrl?: string }) {
  const to = recipients.filter((recipient) => recipient.email).map((recipient) => ({ email: String(recipient.email), name: recipient.name }));
  if (!to.length) return;
  await sendEmail({
    to,
    subject: `Project payment received: ${money(payment.amount)}`,
    html: emailLayout(
      "Project payment received",
      `
        <p>A project payment was added in HisabKitab.</p>
        <p><strong>Project:</strong> ${escapeHtml(payment.projectName ?? "-")}</p>
        <p><strong>Amount:</strong> ${money(payment.amount)}</p>
        ${actionButton("View Payments", payment.paymentUrl ?? appUrl("/project-payments"))}
      `
    )
  });
}
