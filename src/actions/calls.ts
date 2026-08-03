"use server";

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
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
        { userId: session.user.userId, name: initiatorName, status: "accepted" as const, joinedAt: new Date() },
        ...memberIds
          .filter((id: string) => id !== session.user.userId)
          .map((id: string) => ({ userId: id, name: nameOf(id), status: "invited" as const, joinedAt: null }))
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
    const callee = await User.findById(calleeId).select("name email").lean() as any;
    const call = await Call.create({
      organizationId,
      groupId,
      initiatorId: session.user.userId,
      initiatorName,
      mode,
      status: "ringing",
      participants: [
        { userId: session.user.userId, name: initiatorName, status: "accepted", joinedAt: new Date() },
        { userId: calleeId, name: callee?.name || "Member", status: "invited", joinedAt: null }
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

export async function joinCall(callId: string): Promise<{ ok: boolean; message?: string; data?: { participants: Array<{ userId: string; name: string; status: string }> } }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const call = await Call.findOne({ _id: callId, organizationId });
    if (!call) return { ok: false, message: "Call not found" };
    if (call.status === "ended") return { ok: false, message: "Call has ended" };
    const group = await ChatGroup.findOne({ _id: call.groupId, organizationId });
    if (!group) return { ok: false, message: "Group not found" };
    const memberIds = group.members.map((m: any) => (m.userId?._id || m.userId)?.toString());
    if (!memberIds.includes(session.user.userId)) return { ok: false, message: "Not a group member" };
    const me = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (me && me.status === "accepted") return { ok: true, data: { participants: serializeParticipants(call.participants) } };
    const name = session.user.name || "Member";
    const wasNew = !me || me.status === "ended";
    if (me) {
      me.status = "accepted";
      me.joinedAt = new Date();
    } else {
      call.participants.push({ userId: session.user.userId, name, status: "accepted", joinedAt: new Date() });
    }
    call.messages.push({ from: session.user.userId, to: null, type: "joined", payload: { name } });
    await call.save();
    if (wasNew) await logCallEvent(call, session.user.userId, "joined", `${name} joined the call`);
    return { ok: true, data: { participants: serializeParticipants(call.participants) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function respondToCall(callId: string, accept: boolean): Promise<{ ok: boolean; message?: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const call = await Call.findOne({ _id: callId, organizationId });
    if (!call) return { ok: false, message: "Call not found" };
    if (call.status === "ended") return { ok: false, message: "Call has ended" };
    const participant = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (!participant || participant.status !== "invited") return { ok: false, message: "No incoming call" };
    if (accept) {
      participant.status = "accepted";
      participant.joinedAt = new Date();
      call.status = "active";
      call.messages.push({ from: session.user.userId, to: null, type: "accepted", payload: { name: session.user.name || "Member" } });
      await call.save();
      await logCallEvent(call, session.user.userId, "joined", `${session.user.name || "Member"} joined the call`);
    } else {
      participant.status = "declined";
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
      call.messages.push({ from: session.user.userId, to: null, type: "declined", payload: { name: session.user.name || "Member" } });
      await call.save();
      await logCallEvent(call, session.user.userId, "declined", `${session.user.name || "Member"} declined the call`);
    }
    return { ok: true, message: accept ? "Joined" : "Declined" };
  } catch (error) {
    return actionError(error);
  }
}

export async function sendSignal(callId: string, to: string | null, type: string, payload: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const call = await Call.findOne({ _id: callId, organizationId, status: { $ne: "ended" } });
    if (!call) return { ok: false, message: "Call not found or ended" };
    const participant = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (!participant || participant.status !== "accepted") return { ok: false, message: "Not in this call" };
    call.messages.push({
      from: session.user.userId,
      to: to ? new Types.ObjectId(to) : null,
      type,
      payload
    });
    if (type === "ended") {
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
      participant.status = "ended";
    } else if (type === "left") {
      participant.status = "ended";
    }
    await call.save();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function endCall(callId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
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
  message?: string;
}> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const call = await Call.findOne({ _id: callId, organizationId, "participants.userId": session.user.userId }).lean() as any;
    if (!call) return { ok: false, message: "Call not found" };
    const after = afterId && Types.ObjectId.isValid(afterId) ? new Types.ObjectId(afterId) : null;
    const events = (call.messages || [])
      .filter((m: any) => {
        if (String(m.from) === String(session.user.userId)) return false;
        if (m.to && String(m.to) !== String(session.user.userId)) return false;
        if (after && afterId && String(m._id) <= afterId) return false;
        return true;
      })
      .slice(-50)
      .map((m: any) => ({
        id: m._id.toString(),
        type: m.type,
        from: String(m.from),
        payload: m.payload ?? {}
      }));
    return { ok: true, status: call.status, events, participants: serializeParticipants(call.participants) };
  } catch (error) {
    return actionError(error as any) as any;
  }
}
