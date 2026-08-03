"use server";

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { Call } from "@/models/Call";
import { ChatGroup } from "@/models/ChatGroup";
import { User } from "@/models/User";
import { actionError } from "@/actions/helpers";

function serializeParticipants(participants: any[]) {
  return (participants || []).map((p: any) => ({
    userId: String(p.userId),
    name: p.name ?? "",
    status: p.status ?? "invited"
  }));
}

export async function startCall(groupId: string, mode: "audio" | "video", calleeId: string): Promise<{ ok: boolean; message?: string; data?: { callId: string } }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    const group = await ChatGroup.findOne({ _id: groupId, organizationId });
    if (!group) return { ok: false, message: "Group not found" };
    const memberIds = group.members.map((m: any) => (m.userId?._id || m.userId)?.toString());
    if (!memberIds.includes(session.user.userId) || !memberIds.includes(calleeId)) return { ok: false, message: "Not a group member" };
    if (calleeId === session.user.userId) return { ok: false, message: "Cannot call yourself" };
    const existing = await Call.findOne({
      organizationId,
      groupId,
      status: { $ne: "ended" },
      participants: { $elemMatch: { userId: { $in: [session.user.userId, calleeId] } } }
    });
    if (existing) return { ok: false, message: "There is already an active call in this group" };
    const callee = await User.findById(calleeId).select("name").lean() as any;
    const initiatorName = session.user.name || "Someone";
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
    return { ok: true, data: { callId: call._id.toString() } };
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
    if (me && me.status === "invited") return { ok: false, message: "You have an incoming call — accept it from the call screen" };
    const name = session.user.name || "Member";
    if (me) {
      me.status = "accepted";
      me.joinedAt = new Date();
    } else {
      call.participants.push({ userId: session.user.userId, name, status: "accepted", joinedAt: new Date() });
    }
    call.messages.push({ from: session.user.userId, to: null, type: "joined", payload: { name } });
    await call.save();
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
    if (call.status !== "ringing") return { ok: false, message: "Call is no longer active" };
    const participant = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (!participant || participant.status !== "invited") return { ok: false, message: "No incoming call" };
    if (accept) {
      participant.status = "accepted";
      participant.joinedAt = new Date();
      call.status = "active";
      call.messages.push({ from: session.user.userId, to: null, type: "accepted", payload: { name: session.user.name || "Member" } });
    } else {
      participant.status = "declined";
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
      call.messages.push({ from: session.user.userId, to: null, type: "declined", payload: { name: session.user.name || "Member" } });
    }
    await call.save();
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
    } else if (me) {
      call.messages.push({ from: session.user.userId, to: null, type: "left", payload: { name: session.user.name || "Member" } });
    }
    await call.save();
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
