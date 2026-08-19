import { NextRequest } from "next/server";
import { findOrgByDeviceSn, processPunches } from "@/services/device-attendance";

const TEXT = { "Content-Type": "text/plain" };

function authorized(org: any, request: NextRequest): boolean {
  const secret = org.device?.pushSecret;
  if (!secret) return true;
  const sp = request.nextUrl.searchParams;
  const provided = sp.get("password") ?? sp.get("secret") ?? request.headers.get("x-push-secret") ?? "";
  return provided === secret;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const deviceSn = String(sp.get("SN") || sp.get("sn") || "").trim();
  const org: any = await findOrgByDeviceSn(deviceSn);
  if (!org) return new Response("ERR: unknown device", { status: 200, headers: TEXT });
  if (!authorized(org, request)) return new Response("ERR: unauthorized", { status: 200, headers: TEXT });
  const table = String(sp.get("table") || "ATTLOG").toUpperCase();
  if (table !== "ATTLOG") return new Response("OK: 0", { status: 200, headers: TEXT });
  const pin = String(sp.get("pin") || sp.get("PIN") || "").trim();
  const stampStr = String(sp.get("Stamp") || sp.get("timestamp") || sp.get("stamp") || "").trim();
  if (!pin || !stampStr) return new Response("OK: 0", { status: 200, headers: TEXT });
  const stamp = new Date(stampStr.replace(" ", "T"));
  if (isNaN(stamp.getTime())) return new Response("OK: 0", { status: 200, headers: TEXT });
  await processPunches(org, [{ pin, stamp }], deviceSn);
  return new Response("OK: 0", { status: 200, headers: TEXT });
}

export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const deviceSn = String(sp.get("SN") || sp.get("sn") || "").trim();
  const org: any = await findOrgByDeviceSn(deviceSn);
  if (!org) return new Response("ERR: unknown device", { status: 200, headers: TEXT });
  if (!authorized(org, request)) return new Response("ERR: unauthorized", { status: 200, headers: TEXT });
  const text = await request.text();
  const punches: Array<{ pin: string; stamp: string }> = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(";").map((s) => s.trim());
    if (parts.length >= 3 && parts[0] === "C1") {
      punches.push({ pin: parts[1], stamp: parts[2].replace(" ", "T") });
    } else if (parts.length === 2) {
      punches.push({ pin: parts[0], stamp: parts[1].replace(" ", "T") });
    }
  }
  if (punches.length) await processPunches(org, punches, deviceSn);
  return new Response("OK: 0", { status: 200, headers: TEXT });
}