import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireTenant } from "@/lib/permissions";
import { ChatMessage } from "@/models/ChatMessage";
import { ChatGroup } from "@/models/ChatGroup";
import { User } from "@/models/User";

export async function GET(request: Request) {
  try {
    const { session, organizationId } = await requireTenant();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("g");
    if (!groupId) return NextResponse.json({ messages: [], typing: [] });
    await connectToDatabase();
    const messages = await ChatMessage.find({ organizationId: new Types.ObjectId(organizationId), groupId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("senderId", "name email")
      .lean() as any[];
    messages.reverse();
    const now = Date.now();
    const group = await ChatGroup.findOne({ _id: groupId, organizationId }).select("members").lean() as any;
    const typers = (group?.members ?? [])
      .filter(
        (m: any) =>
          m.lastTypedAt &&
          String(m.userId) !== String(session.user.userId) &&
          now - new Date(m.lastTypedAt).getTime() < 3000
      )
      .map((m: any) => m.userId);
    let typing: Array<{ userId: string; name: string }> = [];
    if (typers.length) {
      const users = await User.find({ _id: { $in: typers } }).select("name").lean() as any[];
      typing = users.map((u: any) => ({ userId: String(u._id), name: u.name ?? "Someone" }));
    }
    return NextResponse.json(JSON.parse(JSON.stringify({ messages, typing })));
  } catch {
    return NextResponse.json({ messages: [], typing: [] });
  }
}
