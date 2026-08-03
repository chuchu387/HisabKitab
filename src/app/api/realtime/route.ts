import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Call } from "@/models/Call";
import { ChatGroup } from "@/models/ChatGroup";
import { ChatMessage } from "@/models/ChatMessage";
import { Notification } from "@/models/Notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 4000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.userId) return new Response("Unauthorized", { status: 401 });
  const userId = new Types.ObjectId(String(session.user.userId));
  const organizationId = session.user.organizationId ? new Types.ObjectId(String(session.user.organizationId)) : null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload = "";
      let lastCleanup = 0;
      const send = (payload: unknown) => {
        const json = JSON.stringify(payload);
        if (json === lastPayload) return;
        lastPayload = json;
        try {
          controller.enqueue(encoder.encode(`data: ${json}\n\n`));
        } catch {}
      };
      const keepAlive = () => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {}
      };

      const tick = async () => {
        try {
          await connectToDatabase();
          const now = Date.now();
          if (now - lastCleanup > 30000 && organizationId) {
            lastCleanup = now;
            await Call.updateMany(
              { organizationId, status: "ringing", createdAt: { $lt: new Date(now - 120000) } },
              { $set: { status: "ended", endedAt: new Date() } }
            );
            await Call.updateMany(
              { organizationId, status: "active", createdAt: { $lt: new Date(now - 90000) }, "participants.status": { $nin: ["accepted"] } },
              { $set: { status: "ended", endedAt: new Date() } }
            );
          }
          const [unreadCount, notifications, groups] = await Promise.all([
            Notification.countDocuments({ userId, readAt: null }),
            Notification.find({ userId }).sort({ createdAt: -1 }).limit(10).select("title message href type readAt createdAt").lean(),
            ChatGroup.find({ "members.userId": userId }).sort({ updatedAt: -1 }).select("name description updatedAt members").lean()
          ]);
          const groupIds = groups.map((g: any) => g._id);
          const calls = groupIds.length
            ? await Call.find({ organizationId, status: { $ne: "ended" }, groupId: { $in: groupIds } }).sort({ createdAt: -1 }).limit(10).select("_id groupId initiatorId initiatorName mode status participants createdAt").lean()
            : [];
          const previews = await Promise.all(groups.map((group: any) =>
            ChatMessage.findOne({ groupId: group._id }).sort({ createdAt: -1 }).select("content senderId createdAt").populate("senderId", "name").lean()
          ));
          send({
            type: "tick",
            unreadCount,
            notifications: JSON.parse(JSON.stringify(notifications)),
            chatGroups: JSON.parse(JSON.stringify(groups.map((group: any, index: number) => ({
              _id: group._id.toString(),
              name: group.name,
              description: group.description ?? "",
              updatedAt: group.updatedAt,
              memberCount: (group.members ?? []).length,
              isDM: group.isDM ?? false,
              lastMessage: previews[index] ?? null
            })))),
            calls: JSON.parse(JSON.stringify(calls.map((call: any) => {
              const me = (call.participants ?? []).find((p: any) => String(p.userId) === String(userId));
              return {
                callId: call._id.toString(),
                groupId: call.groupId?.toString() ?? "",
                groupName: groups.find((g: any) => String(g._id) === String(call.groupId))?.name ?? "",
                initiatorId: String(call.initiatorId),
                initiatorName: call.initiatorName ?? "",
                mode: call.mode ?? "audio",
                status: call.status,
                myStatus: me?.status ?? "none",
                createdAt: call.createdAt
              };
            })))
          });
        } catch {}
      };

      await tick();
      const interval = setInterval(tick, POLL_INTERVAL_MS);
      const keepAliveInterval = setInterval(keepAlive, 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(keepAliveInterval);
        try { controller.close(); } catch {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
