import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { PushSubscription } from "@/models/PushSubscription";

export async function POST(request: NextRequest) {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!endpoint || !p256dh || !auth) return NextResponse.json({ ok: false, message: "Invalid subscription" }, { status: 400 });
    await PushSubscription.findOneAndUpdate(
      { organizationId, userId: session.user.userId, endpoint },
      { organizationId, userId: session.user.userId, endpoint, keys: { p256dh, auth }, userAgent: request.headers.get("user-agent") ?? "" },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const body = await request.json().catch(() => null);
    if (body?.endpoint) {
      await PushSubscription.deleteOne({ organizationId, userId: session.user.userId, endpoint: body.endpoint });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
}
