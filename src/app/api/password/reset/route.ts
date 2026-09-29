import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { User } from "@/models/User";
import { resetPasswordSchema } from "@/validations/schemas";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: parsed.error.errors[0]?.message ?? "Invalid reset request" }, { status: 400 });
    }

    await connectToDatabase();
    const tokenHash = hashToken(parsed.data.token);
    const reset = await PasswordResetToken.findOne({ tokenHash, usedAt: null, expiresAt: { $gt: new Date() } });
    if (!reset) return NextResponse.json({ ok: false, message: "Reset link is invalid or expired" }, { status: 400 });

    await User.updateOne({ _id: reset.userId }, { password: await bcrypt.hash(parsed.data.password, 12) });
    reset.usedAt = new Date();
    await reset.save();

    return NextResponse.json({ ok: true, message: "Password reset. You can sign in now." });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ ok: false, message: "Unable to reset password right now" }, { status: 500 });
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
