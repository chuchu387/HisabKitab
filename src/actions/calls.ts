"use server";

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireFeature } from "@/lib/permissions";
import { Call } from "@/models/Call";
import { ChatGroup } from "@/models/ChatGroup";
import { ChatMessage } from "@/models/ChatMessage";
import { User } from "@/models/User";
import { notifyCallStarted } from "@/services/notifications";
import { actionError } from "@/actions/helpers";

function notifyCall(recipients: Array<{ _id: unknown; email?: string | null; name?: string | null; organizationId: string }>, call: { groupId: string; groupName?: string; initiatorName: string; mode: string; callId?: string }) {
  notifyCallStarted(recipients, call).catch(() => undefined);
}

function serializeParticipants(participants: any[]) {
  return (participants || []).map((p: any) => ({
    userId: String(p.userId),
    name: p.name ?? "",
    status: p.status ?? "invited"
  }));
}

function latestMessageId(call: any) {
  const messages = call?.messages ?? [];
  return messages.length ? String(messages[messages.length - 1]._id) : "";
}

async function logCallEvent(call: any, senderId: string, event: "started" | "joined" | "ended" | "declined", content: string) {
  try {
    await ChatMessage.create({
      organizationId: call.organizationId,
      groupId: call.groupId,
      senderId,
      content,
      type: "call",
      callEvent: event,
      callId: call._id
    });
  } catch {}
}

export async function startCall(groupId: string, mode: "audio" | "video", calleeId: string): Promise<{ ok: boolean; message?: string; data?: { callId: string; participants: Array<{ userId: string; name: string; status: string }> } }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    if (!Types.ObjectId.isValid(groupId)) return { ok: false, message: "Invalid group" };
    if (!(["audio", "video"] as string[]).includes(mode)) return { ok: false, message: "Invalid call mode" };
    if (calleeId !== "all" && !Types.ObjectId.isValid(calleeId)) return { ok: false, message: "Invalid recipient" };
    const group = await ChatGroup.findOne({ _id: groupId, organizationId });
    if (!group) return { ok: false, message: "Group not found" };
    const memberIds = group.members.map((m: any) => (m.userId?._id || m.userId)?.toString());
    if (!memberIds.includes(session.user.userId)) return { ok: false, message: "Not a group member" };
    if (calleeId !== "all" && !memberIds.includes(calleeId)) return { ok: false, message: "Not a group member" };
    const initiatorName = session.user.name || "Someone";

    if (calleeId === "all") {
      const existing = await Call.findOne({ organizationId, groupId, status: { $ne: "ended" } });
      if (existing) return { ok: false, message: "There is already an active call in this group" };
      const members = await User.find({ _id: { $in: memberIds } }).select("name email").lean() as any[];
      const nameOf = (id: string) => members.find((m: any) => String(m._id) === id)?.name || "Member";
      const participants = [
        { userId: session.user.userId, name: initiatorName, status: "accepted" as const, joinedAt: new Date(), lastSeenAt: new Date() },
        ...memberIds
          .filter((id: string) => id !== session.user.userId)
          .map((id: string) => ({ userId: id, name: nameOf(id), status: "invited" as const, joinedAt: null, lastSeenAt: null }))
      ];
      const call = await Call.create({
        organizationId,
        groupId,
        initiatorId: session.user.userId,
        initiatorName,
        mode,
        status: "ringing",
        participants,
        messages: []
      });
      await logCallEvent(call, session.user.userId, "started", `${initiatorName} started a ${mode} call for the whole group`);
      notifyCall(
        members
          .filter((m: any) => String(m._id) !== String(session.user.userId))
          .map((m: any) => ({ _id: m._id, email: m.email, name: m.name, organizationId })),
        { groupId, groupName: group.name, initiatorName, mode, callId: call._id.toString() }
      );
      return { ok: true, data: { callId: call._id.toString(), participants: serializeParticipants(call.participants) } };
    }

    if (calleeId === session.user.userId) return { ok: false, message: "Cannot call yourself" };
    const existing = await Call.findOne({
      organizationId,
      groupId,
      status: { $ne: "ended" },
      participants: { $elemMatch: { userId: { $in: [session.user.userId, calleeId] } } }
    });
    if (existing) return { ok: false, message: "There is already an active call in this group" };
    const callee = await User.findOne({ _id: calleeId, organizationId, active: true }).select("name email").lean() as any;
    if (!callee) return { ok: false, message: "Recipient is unavailable" };
    const call = await Call.create({
      organizationId,
      groupId,
      initiatorId: session.user.userId,
      initiatorName,
      mode,
      status: "ringing",
      participants: [
        { userId: session.user.userId, name: initiatorName, status: "accepted", joinedAt: new Date(), lastSeenAt: new Date() },
        { userId: calleeId, name: callee.name || "Member", status: "invited", joinedAt: null, lastSeenAt: null }
      ],
      messages: []
    });
    await logCallEvent(call, session.user.userId, "started", `${initiatorName} started a ${mode} call`);
    if (callee) {
      notifyCall(
        [{ _id: callee._id, email: callee.email, name: callee.name, organizationId }],
        { groupId, groupName: group.name, initiatorName, mode, callId: call._id.toString() }
      );
    }
    return { ok: true, data: { callId: call._id.toString(), participants: serializeParticipants(call.participants) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function joinCall(callId: string): Promise<{ ok: boolean; message?: string; data?: { participants: Array<{ userId: string; name: string; status: string }>; cursor: string } }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    if (!Types.ObjectId.isValid(callId)) return { ok: false, message: "Invalid call" };
    const call = await Call.findOne({ _id: callId, organizationId });
    if (!call) return { ok: false, message: "Call not found" };
    if (call.status === "ended") return { ok: false, message: "Call has ended" };
    const group = await ChatGroup.findOne({ _id: call.groupId, organizationId });
    if (!group) return { ok: false, message: "Group not found" };
    const memberIds = group.members.map((m: any) => (m.userId?._id || m.userId)?.toString());
    if (!memberIds.includes(session.user.userId)) return { ok: false, message: "Not a group member" };
    const me = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (me && me.status === "accepted") {
      me.lastSeenAt = new Date();
      call.messages.push({ from: session.user.userId, to: null, type: "joined", payload: { name: me.name || session.user.name || "Member", reconnect: true } });
      await call.save();
      return { ok: true, data: { participants: serializeParticipants(call.participants), cursor: latestMessageId(call) } };
    }
    const name = session.user.name || "Member";
    const wasNew = !me || me.status === "ended";
    if (me) {
      me.status = "accepted";
      me.joinedAt = new Date();
      me.lastSeenAt = new Date();
    } else {
      call.participants.push({ userId: session.user.userId, name, status: "accepted", joinedAt: new Date(), lastSeenAt: new Date() });
    }
    call.status = "active";
    call.messages.push({ from: session.user.userId, to: null, type: "joined", payload: { name } });
    await call.save();
    if (wasNew) await logCallEvent(call, session.user.userId, "joined", `${name} joined the call`);
    return { ok: true, data: { participants: serializeParticipants(call.participants), cursor: latestMessageId(call) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function respondToCall(callId: string, accept: boolean): Promise<{ ok: boolean; message?: string; data?: { cursor: string } }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    if (!Types.ObjectId.isValid(callId)) return { ok: false, message: "Invalid call" };
    const call = await Call.findOne({ _id: callId, organizationId });
    if (!call) return { ok: false, message: "Call not found" };
    if (call.status === "ended") return { ok: false, message: "Call has ended" };
    const participant = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (!participant || participant.status !== "invited") return { ok: false, message: "No incoming call" };
    if (accept) {
      participant.status = "accepted";
      participant.joinedAt = new Date();
      participant.lastSeenAt = new Date();
      call.status = "active";
      call.messages.push({ from: session.user.userId, to: null, type: "accepted", payload: { name: session.user.name || "Member" } });
      await call.save();
      await logCallEvent(call, session.user.userId, "joined", `${session.user.name || "Member"} joined the call`);
    } else {
      participant.status = "declined";
      const remaining = call.participants.filter(
        (p: any) => String(p.userId) !== String(session.user.userId) && ["accepted", "invited"].includes(p.status)
      );
      const callEnded = remaining.length <= 1;
      if (callEnded) {
        call.status = "ended";
        call.endedAt = new Date();
        call.endedBy = session.user.userId;
      }
      call.messages.push({
        from: session.user.userId,
        to: null,
        type: "declined",
        payload: { name: session.user.name || "Member", callEnded }
      });
      await call.save();
      await logCallEvent(call, session.user.userId, "declined", `${session.user.name || "Member"} declined the call`);
    }
    return { ok: true, message: accept ? "Joined" : "Declined", data: { cursor: latestMessageId(call) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function sendSignal(callId: string, to: string | null, type: string, payload: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    if (!Types.ObjectId.isValid(callId)) return { ok: false, message: "Invalid call" };
    const allowedTypes = new Set(["offer", "answer", "ice", "ended", "left"]);
    if (!allowedTypes.has(type)) return { ok: false, message: "Unsupported call signal" };
    if (to && !Types.ObjectId.isValid(to)) return { ok: false, message: "Invalid signal recipient" };
    if (JSON.stringify(payload ?? {}).length > 64 * 1024) return { ok: false, message: "Call signal is too large" };
    const query: Record<string, unknown> = {
      _id: callId,
      organizationId,
      status: { $ne: "ended" },
      participants: { $elemMatch: { userId: session.user.userId, status: "accepted" } }
    };
    if (to) query.participants = { $all: [{ $elemMatch: { userId: session.user.userId, status: "accepted" } }, { $elemMatch: { userId: to, status: "accepted" } }] };
    const message = {
      from: session.user.userId,
      to: to ? new Types.ObjectId(to) : null,
      type,
      payload
    };
    const update: Record<string, unknown> = {
      $push: { messages: { $each: [message], $slice: -500 } }
    };
    if (type === "ended") {
      update.$set = { status: "ended", endedAt: new Date(), endedBy: session.user.userId, "participants.$[me].status": "ended" };
    } else if (type === "left") {
      update.$set = { "participants.$[me].status": "ended" };
    }
    const options = type === "ended" || type === "left"
      ? { arrayFilters: [{ "me.userId": session.user.userId }] }
      : undefined;
    const result = await Call.updateOne(query, update, options);
    if (!result.matchedCount) return { ok: false, message: "Call not found, ended, or access denied" };
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function endCall(callId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    if (!Types.ObjectId.isValid(callId)) return { ok: false, message: "Invalid call" };
    const call = await Call.findOne({ _id: callId, organizationId });
    if (!call) return { ok: false, message: "Call not found" };
    const me = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (me && me.status !== "declined") me.status = "ended";
    const remaining = call.participants.filter(
      (p: any) => p.status === "accepted" && String(p.userId) !== String(session.user.userId)
    ).length;
    if (call.status !== "ended" && remaining < 2) {
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
      call.messages.push({ from: session.user.userId, to: null, type: "ended", payload: {} });
      await call.save();
      await logCallEvent(call, session.user.userId, "ended", "Call ended");
    } else if (me) {
      call.messages.push({ from: session.user.userId, to: null, type: "left", payload: { name: session.user.name || "Member" } });
      await call.save();
    }
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function getCallEvents(callId: string, afterId: string | null): Promise<{
  ok: boolean;
  status?: string;
  events?: Array<{ id: string; type: string; from: string; payload: any }>;
  participants?: Array<{ userId: string; name: string; status: string }>;
  hasMore?: boolean;
  message?: string;
}> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    if (!Types.ObjectId.isValid(callId)) return { ok: false, message: "Invalid call" };
    const heartbeatCutoff = new Date(Date.now() - 10000);
    await Call.updateOne(
      {
        _id: callId,
        organizationId,
        participants: { $elemMatch: { userId: session.user.userId, status: "accepted", $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: heartbeatCutoff } }] } }
      },
      { $set: { "participants.$.lastSeenAt": new Date() } }
    );
    const call = await Call.findOne({ _id: callId, organizationId, "participants.userId": session.user.userId }).lean() as any;
    if (!call) return { ok: false, message: "Call not found" };
    const messages = call.messages || [];
    const cursorIndex = afterId ? messages.findIndex((message: any) => String(message._id) === afterId) : -1;
    const eligible = messages
      .filter((m: any) => {
        if (String(m.from) === String(session.user.userId)) return false;
        if (m.to && String(m.to) !== String(session.user.userId)) return false;
        if (afterId && cursorIndex >= 0 && messages.indexOf(m) <= cursorIndex) return false;
        return true;
      });
    const page = eligible.slice(0, 100);
    const events = page
      .map((m: any) => ({
        id: m._id.toString(),
        type: m.type,
        from: String(m.from),
        payload: m.payload ?? {}
      }));
    return { ok: true, status: call.status, events, participants: serializeParticipants(call.participants), hasMore: eligible.length > page.length };
  } catch (error) {
    return actionError(error as any) as any;
  }
}
