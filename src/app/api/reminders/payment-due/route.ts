import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { sendPaymentDueReminders } from "@/services/payment-reminders";

export async function GET(request: NextRequest) {
  const secret = process.env.REMINDER_CRON_SECRET ?? process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) return NextResponse.json({ error: "Reminder cron secret is not configured" }, { status: 503 });
  if (secret) {
    const auth = request.headers.get("authorization");
    const token = request.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && token !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const result = await sendPaymentDueReminders({ triggeredBy: "cron" });
  return NextResponse.json(result);
}
