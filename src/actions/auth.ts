"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { forgotPasswordSchema, resetPasswordSchema } from "@/validations/schemas";
import { actionButton, appUrl, emailLayout, escapeHtml, sendEmail } from "@/services/email";
import type { ActionState } from "@/types";

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard"
    });
    return { ok: true, message: "Signed in" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, message: "Invalid email or password" };
    }
    throw error;
  }
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, message: "Enter a valid email address" };
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
    }).catch((error) => {
      console.error("Password reset email threw", error);
      return { ok: false, error: "exception" };
    });
    if (!emailResult?.ok) {
      console.error("Password reset email not sent", {
        skipped: "skipped" in emailResult ? emailResult.skipped : false,
        hasBrevoApiKey: Boolean(process.env.BREVO_API_KEY),
        hasBrevoSenderEmail: Boolean(process.env.BREVO_SENDER_EMAIL),
        userId: user._id?.toString?.()
      });
    }
  }
  return { ok: true, message: "If the email exists, a reset link has been sent" };
}

export async function resetPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid reset request" };
  await connectToDatabase();
  const tokenHash = hashToken(parsed.data.token);
  const reset = await PasswordResetToken.findOne({ tokenHash, usedAt: null, expiresAt: { $gt: new Date() } });
  if (!reset) return { ok: false, message: "Reset link is invalid or expired" };
  await User.updateOne({ _id: reset.userId }, { password: await bcrypt.hash(parsed.data.password, 12) });
  reset.usedAt = new Date();
  await reset.save();
  return { ok: true, message: "Password reset. You can sign in now." };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
