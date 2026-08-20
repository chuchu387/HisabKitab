"use server";

import { connectToDatabase } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { Organization } from "@/models/Organization";
import { getHikDeviceInfo, syncHikvisionOrg } from "@/services/hikvision-attendance";

export async function testDeviceConnection(organizationId: string): Promise<{ ok: boolean; message: string }> {
  try {
    await requireRole(["super_admin"]);
    await connectToDatabase();
    const org: any = await Organization.findById(organizationId).select("name device").lean();
    if (!org) return { ok: false, message: "Organization not found" };
    if (org.device?.deviceVendor !== "hikvision") return { ok: false, message: "Test connection is only available for Hikvision devices" };
    if (!org.device?.deviceUrl || !org.device?.deviceUsername || !org.device?.devicePassword) {
      return { ok: false, message: "Fill in the device URL, username, and password first" };
    }
    const info = await getHikDeviceInfo(org);
    if (!info) return { ok: false, message: "Could not reach the device. Check the URL, port forward, username, and password." };
    const result = await syncHikvisionOrg(org, 120);
    const detail = `${info.model} (serial ${info.serial}, firmware ${info.firmware}). Events in last 2h: ${result.events ?? 0} | check-ins: ${result.checkedIn ?? 0} | check-outs: ${result.checkedOut ?? 0} | unmatched: ${result.unmatched ?? 0}`;
    return { ok: true, message: detail };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Test failed" };
  }
}