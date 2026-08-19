import { NextResponse, type NextRequest } from "next/server";
import { findOrgByDeviceSn, processPunches } from "@/services/device-attendance";

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const deviceSn = String(body.deviceSn || body.sn || request.headers.get("x-device-sn") || "").trim();
    if (!deviceSn) return NextResponse.json({ error: "deviceSn required" }, { status: 400 });
    const org: any = await findOrgByDeviceSn(deviceSn);
    if (!org) return NextResponse.json({ error: "Unknown device" }, { status: 404 });
    if (org.device?.pushSecret) {
      const secret = request.headers.get("x-push-secret") || String(body.secret || "");
      if (secret !== org.device.pushSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const punches = Array.isArray(body.punches) ? body.punches : Array.isArray(body) ? body : [];
    if (!punches.length) return NextResponse.json({ error: "No punches" }, { status: 400 });
    const result = await processPunches(org, punches, deviceSn);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}