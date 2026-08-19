import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Organization } from "@/models/Organization";
import { processPunches } from "@/services/device-attendance";

export async function GET(request: NextRequest) {
  const secret = process.env.REMINDER_CRON_SECRET ?? process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) return NextResponse.json({ error: "Cron secret is not configured" }, { status: 503 });
  if (secret) {
    const auth = request.headers.get("authorization");
    const token = request.nextUrl.searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && token !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDatabase();
  const orgs: any[] = await Organization.find({ attendanceMode: "device", "device.pollEnabled": true, "device.deviceUrl": { $ne: "" } }).lean();
  const summary: any[] = [];
  for (const org of orgs) {
    const url = org.device.deviceUrl.replace(/\/+$/, "");
    const sn = encodeURIComponent(org.device.deviceSn || "");
    try {
      const res = await fetch(`${url}/iclock/cdata?SN=${sn}&table=ATTLOG&options=timestamp,count=200`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const punches: Array<{ pin: string; stamp: string }> = [];
      for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        const parts = line.split(";").map((s) => s.trim());
        if (parts.length >= 3 && parts[0] === "C1") punches.push({ pin: parts[1], stamp: parts[2].replace(" ", "T") });
        else if (parts.length === 2) punches.push({ pin: parts[0], stamp: parts[1].replace(" ", "T") });
      }
      const result = punches.length ? await processPunches(org, punches, org.device.deviceSn || "") : { checkedIn: 0, checkedOut: 0, ignored: 0, unmatched: 0 };
      summary.push({ org: org.name, url, punches: punches.length, ...result });
    } catch (error) {
      summary.push({ org: org.name, url, error: error instanceof Error ? error.message : "Failed" });
    }
  }
  return NextResponse.json({ ok: true, summary });
}