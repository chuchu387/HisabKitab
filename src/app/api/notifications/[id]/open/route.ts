import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { Notification } from "@/models/Notification";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { organizationId, session } = await requireTenant();
  const { id } = await params;
  await connectToDatabase();
  const notification = await Notification.findOneAndUpdate(
    { _id: id, organizationId, userId: session.user.userId },
    { readAt: new Date() },
    { new: true }
  ).lean() as any;
  const href = typeof notification?.href === "string" && notification.href.startsWith("/") ? notification.href : "/dashboard";
  return NextResponse.redirect(new URL(href, request.url));
}
