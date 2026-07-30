import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { ChatMessage } from "@/models/ChatMessage";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("g");
    if (!groupId) return NextResponse.json([]);
    await connectToDatabase();
    const messages = await ChatMessage.find({ organizationId: new Types.ObjectId(organizationId), groupId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("senderId", "name email")
      .lean() as any[];
    messages.reverse();
    return NextResponse.json(JSON.parse(JSON.stringify(messages)));
  } catch {
    return NextResponse.json([]);
  }
}
