import { connectToDatabase } from "@/lib/db";
import { EmailLog } from "@/models/EmailLog";

type EmailRecipient = {
  email: string;
  name?: string | null;
};

type SendEmailInput = {
  to: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  organizationId?: string | null;
  template?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

const brevoEndpoint = "https://api.brevo.com/v3/smtp/email";

function sender() {
  return {
    name: process.env.BREVO_SENDER_NAME ?? "HisabKitab",
    email: process.env.BREVO_SENDER_EMAIL ?? "support.codastralabs@gmail.com"
  };
}

function enabled() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

export async function sendEmail({ to, subject, html, text, organizationId, template = "general", entityType = "", entityId = "", metadata = {} }: SendEmailInput) {
  const recipients = to.filter((recipient) => recipient.email);
  if (!enabled() || recipients.length === 0) {
    await writeEmailLog({
      organizationId,
      recipients,
      subject,
      template,
      status: "skipped",
      entityType,
      entityId,
      metadata: {
        ...metadata,
        enabled: enabled(),
        recipientCount: recipients.length
      }
    });
    return { ok: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(brevoEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": String(process.env.BREVO_API_KEY),
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: sender(),
        to: recipients.map((recipient) => ({ email: recipient.email, name: recipient.name ?? undefined })),
        subject,
        htmlContent: html,
        textContent: text ?? stripHtml(html)
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("Brevo email failed", response.status, responseBody);
      await writeEmailLog({ organizationId, recipients, subject, template, status: "failed", responseStatus: response.status, responseBody, entityType, entityId, metadata });
      return { ok: false };
    }
    await writeEmailLog({ organizationId, recipients, subject, template, status: "sent", responseStatus: response.status, entityType, entityId, metadata });
    return { ok: true };
  } catch (error) {
    console.error("Brevo email error", error);
    await writeEmailLog({ organizationId, recipients, subject, template, status: "failed", error: error instanceof Error ? error.message : String(error), entityType, entityId, metadata });
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

export function appUrl(path = "/dashboard") {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

export function emailLayout(title: string, body: string) {
  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px">
        <div style="background:#071516;color:white;border-radius:12px 12px 0 0;padding:20px 24px">
          <div style="font-size:18px;font-weight:700">HisabKitab</div>
          <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">Accounting workspace</div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px">
          <h1 style="font-size:20px;line-height:28px;margin:0 0 16px">${escapeHtml(title)}</h1>
          <div style="font-size:14px;line-height:22px;color:#374151">${body}</div>
        </div>
      </div>
    </div>
  `;
}

export function actionButton(label: string, href: string) {
  return `<p style="margin:22px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#168f84;color:white;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">${escapeHtml(label)}</a></p>`;
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function writeEmailLog(input: {
  organizationId?: string | null;
  recipients: EmailRecipient[];
  subject: string;
  template: string;
  status: "sent" | "failed" | "skipped";
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await connectToDatabase();
    await EmailLog.create({
      organizationId: input.organizationId || null,
      recipients: input.recipients.map((recipient) => ({ email: recipient.email, name: recipient.name ?? "" })),
      subject: input.subject,
      template: input.template,
      status: input.status,
      responseStatus: input.responseStatus ?? null,
      responseBody: input.responseBody?.slice(0, 2000) ?? "",
      error: input.error?.slice(0, 1000) ?? "",
      entityType: input.entityType ?? "",
      entityId: input.entityId ?? "",
      metadata: input.metadata ?? {}
    });
  } catch (error) {
    console.error("Email log write failed", error);
  }
}
