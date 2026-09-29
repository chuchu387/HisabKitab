import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";
import { forgotPasswordSchema } from "@/validations/schemas";
import { actionButton, appUrl, emailLayout, escapeHtml, sendEmail } from "@/services/email";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse({ email: payload.email });
    if (!parsed.success) return NextResponse.json({ ok: false, message: "Enter a valid email address" }, { status: 400 });

    await connectToDatabase();
    const user = await User.findOne({ email: parsed.data.email, active: true }).lean() as any;
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 30) });
      const resetUrl = appUrl(`/reset-password?token=${token}`);
      const emailResult = await sendEmail({
        to: [{ email: user.email, name: user.name }],
        subject: "Reset your HisabKitab password",
        organizationId: user.organizationId?.toString?.() ?? null,
        template: "password_reset",
        entityType: "User",
        entityId: user._id?.toString?.(),
        html: emailLayout("Reset your password", `
          <p>Hello ${escapeHtml(user.name)},</p>
          <p>Use the button below to reset your HisabKitab password. This link expires in 30 minutes.</p>
          ${actionButton("Reset Password", resetUrl)}
          <p>If you did not request this, you can ignore this email.</p>
        `)
      });
      if (!emailResult.ok) {
        console.error("Password reset API email not sent", {
          email: user.email,
          hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
          hasBrevoSenderEmail: Boolean(process.env.BREVO_SENDER_EMAIL),
          emailResult
        });
      }
    }

    return NextResponse.json({ ok: true, message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Password reset request failed", error);
    return NextResponse.json({ ok: false, message: "Unable to send reset link right now" }, { status: 500 });
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
