"use server";

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { Call } from "@/models/Call";
import { ChatGroup } from "@/models/ChatGroup";
import { User } from "@/models/User";
import { actionError } from "@/actions/helpers";

export async function startCall(groupId: string, mode: "audio" | "video", calleeId: string): Promise<{ ok: boolean; message?: string; data?: { callId: string } }> {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    const group = await ChatGroup.findOne({ _id: groupId, organizationId });
    if (!group) return { ok: false, message: "Group not found" };
    const memberIds = group.members.map((m: any) => (m.userId?._id || m.userId)?.toString());
    if (!memberIds.includes(session.user.userId) || !memberIds.includes(calleeId)) return { ok: false, message: "Not a group member" };
    if (calleeId === session.user.userId) return { ok: false, message: "Cannot call yourself" };
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

export async function respondToCall(callId: string, accept: boolean): Promise<{ ok: boolean; message?: string }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const call = await Call.findOne({ _id: callId, organizationId });
    if (!call) return { ok: false, message: "Call not found" };
    const participant = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (!participant || participant.status !== "invited") return { ok: false, message: "No incoming call" };
    if (accept) {
      participant.status = "accepted";
      participant.joinedAt = new Date();
      call.status = "active";
      call.messages.push({ from: session.user.userId, to: call.initiatorId, type: "accepted", payload: {} });
    } else {
      participant.status = "declined";
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
      call.messages.push({ from: session.user.userId, to: "all", type: "declined", payload: { name: session.user.name || "Member" } });
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
    if (type === "ended" || type === "left") {
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
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
    if (call.status !== "ended") {
      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = session.user.userId;
      call.messages.push({ from: session.user.userId, to: "all", type: "ended", payload: {} });
    }
    const participant = call.participants.find((p: any) => p.userId.toString() === session.user.userId);
    if (participant && participant.status !== "declined") participant.status = "ended";
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
        if (after && m._id <= after) return false;
        return true;
      })
      .slice(-50)
      .map((m: any) => ({
        id: m._id.toString(),
        type: m.type,
        from: String(m.from),
        payload: m.payload ?? {}
      }));
    return { ok: true, status: call.status, events };
  } catch (error) {
    return actionError(error as any) as any;
  }
}
