"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/db";
import { requireFeature, requireTenant } from "@/lib/permissions";
import { ChatGroup } from "@/models/ChatGroup";
import { ChatMessage } from "@/models/ChatMessage";
import { User } from "@/models/User";
import { getReceiptBucket } from "@/services/gridfs";
import { sendEmail, emailLayout, actionButton, appUrl, escapeHtml } from "@/services/email";
import { actionError } from "@/actions/helpers";
import { writeAuditLog } from "@/services/audit";
import { sendPushToUser } from "@/services/push";
import { Types, mongo } from "mongoose";

export async function openConversation(targetUserId: string): Promise<{ ok: boolean; message?: string; data?: { groupId: string } }> {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    const oid = new Types.ObjectId(organizationId);
    const target = await User.findOne({ _id: targetUserId, organizationId: oid, active: true }).select("name").lean() as any;
    if (!target) return { ok: false, message: "User not found" };
    if (String(target._id) === String(session.user.userId)) return { ok: false, message: "Cannot start a chat with yourself" };
    const existing = await ChatGroup.findOne({
      organizationId: oid,
      isDM: true,
      $and: [{ "members.userId": session.user.userId }, { "members.userId": targetUserId }]
    }).lean() as any;
    if (existing) return { ok: true, data: { groupId: existing._id.toString() } };
    const group = await ChatGroup.create({
      organizationId: oid,
      name: target.name || "Private chat",
      description: "Direct message",
      isDM: true,
      createdBy: session.user.userId,
      members: [
        { userId: session.user.userId, role: "member", joinedAt: new Date() },
        { userId: targetUserId, role: "member", joinedAt: new Date() }
      ]
    });
    revalidatePath("/chat");
    return { ok: true, data: { groupId: group._id.toString() } };
  } catch (error) {
    return actionError(error);
  }
}

export async function createGroup(formData: FormData) {
  try {
    const { session, organizationId } = await requireFeature("chatManage");
    await connectToDatabase();
    const name = String(formData.get("name") || "").trim();
    if (!name) return { ok: false, message: "Group name required" };
    const description = String(formData.get("description") || "").trim();
    const memberIds = formData.getAll("members") as string[];
    const members: { userId: string; role: string; joinedAt: Date }[] = memberIds.map((id) => ({ userId: id, role: "member", joinedAt: new Date() }));
    members.push({ userId: session.user.userId, role: "admin", joinedAt: new Date() });
    const group = await ChatGroup.create({ organizationId, name, description, members, createdBy: session.user.userId });
    await writeAuditLog({ organizationId, userId: session.user.userId, action: "Chat Group Created", entityType: "ChatGroup", entityId: group._id.toString(), metadata: { name } });
    const addedUsers = await User.find({ _id: { $in: memberIds }, organizationId }).lean() as any[];
    const groupUrl = appUrl(`/chat?g=${group._id}`);
    for (const user of addedUsers) {
      await sendEmail({
        to: [{ email: user.email, name: user.name }],
        subject: `You've been added to "${name}" group on HisabKitab`,
        html: emailLayout("New Chat Group",
          `<p>Hello ${user.name},</p><p>You have been added to the <strong>${name}</strong> chat group.</p>
           <p>Description: ${description || "N/A"}</p>${actionButton("Open Chat", groupUrl)}`
        ),
        organizationId
      });
    }
    revalidatePath("/chat");
    return { ok: true, data: { id: group._id.toString() }, message: "Group created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function addMembers(groupId: string, formData: FormData) {
  try {
    const { session, organizationId } = await requireFeature("chatManage");
    await connectToDatabase();
    const group = await ChatGroup.findOne({ _id: groupId, organizationId });
    if (!group) throw new Error("Group not found");
    const memberIds = formData.getAll("members") as string[];
    const existing = group.members.map((m: any) => m.userId.toString());
    const newIds = memberIds.filter((id) => !existing.includes(id));
    for (const id of newIds) {
      group.members.push({ userId: id, role: "member", joinedAt: new Date() });
    }
    await group.save();
    const addedUsers = await User.find({ _id: { $in: newIds }, organizationId }).lean() as any[];
    const groupUrl = appUrl(`/chat?g=${group._id}`);
    for (const user of addedUsers) {
      await sendEmail({
        to: [{ email: user.email, name: user.name }],
        subject: `You've been added to "${group.name}" group on HisabKitab`,
        html: emailLayout("Added to Chat Group",
          `<p>Hello ${user.name},</p><p>You have been added to the <strong>${group.name}</strong> chat group.</p>${actionButton("Open Chat", groupUrl)}`
        ),
        organizationId
      });
    }
    revalidatePath("/chat");
    return { ok: true, message: "Members added" };
  } catch (error) {
    return actionError(error);
  }
}

export async function sendMessage(formData: FormData) {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    const groupId = String(formData.get("groupId"));
    const content = String(formData.get("content") || "").trim();
    const replyTo = String(formData.get("replyTo") || "");
    const mentionsRaw = String(formData.get("mentions") || "");
    const mentions = mentionsRaw ? mentionsRaw.split(",").filter(Boolean) : [];

    const files = formData.getAll("files") as File[];
    const attachments: any[] = [];

    for (const file of files) {
      if (file.size === 0) continue;
      if (file.size > 10 * 1024 * 1024) return { ok: false, message: `"${file.name}" exceeds 10MB limit` };
      const bucket = await getReceiptBucket();
      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = bucket.openUploadStream(file.name, {
        contentType: file.type,
        metadata: { organizationId, userId: session.user.userId, groupId, type: "chat" }
      });
      await new Promise<void>((resolve, reject) => {
        upload.end(buffer, (error?: Error) => (error ? reject(error) : resolve()));
      });
      attachments.push({ name: file.name, fileId: upload.id.toString(), size: file.size, mimeType: file.type });
    }

    if (!content && !attachments.length) return { ok: false, message: "Message or file required" };

    const message = await ChatMessage.create({
      organizationId,
      groupId,
      senderId: session.user.userId,
      content,
      replyTo: replyTo || null,
      mentions,
      attachments
    });

    await ChatGroup.updateOne(
      { _id: groupId, "members.userId": session.user.userId },
      { $set: { "members.$.lastReadAt": new Date() } }
    );

    const sender = await User.findById(session.user.userId).select("name").lean() as any;
    const group = await ChatGroup.findById(groupId).lean() as any;
    if (group) {
      const memberIds = group.members.map((m: any) => m.userId.toString()).filter((id: string) => id !== session.user.userId);
      const members = await User.find({ _id: { $in: memberIds }, organizationId }).lean() as any[];
      const groupUrl = appUrl(`/chat?g=${groupId}`);
      const preview = content ? (content.length > 100 ? content.slice(0, 100) + "..." : content) : (attachments.length ? `${attachments.length} file(s)` : "");
      for (const member of members) {
        sendPushToUser(organizationId, member._id, {
          title: `${sender?.name || "Someone"} in ${group.name}`,
          message: preview,
          href: `/chat?g=${groupId}`,
          type: "chat"
        }).catch(() => {});
        sendEmail({
          to: [{ email: member.email, name: member.name }],
          subject: `[${group.name}] ${sender?.name || "Someone"}: ${preview}`,
          html: emailLayout(`New message in ${group.name}`,
            `<p><strong>${sender?.name || "Someone"}</strong> wrote in <strong>${group.name}</strong>:</p>
             ${content ? `<div style="margin:12px 0;padding:12px;background:#f3f4f6;border-radius:8px;font-size:14px">${escapeHtml(content)}</div>` : ""}
             ${attachments.length ? `<p style="color:#6b7280">📎 ${attachments.length} attachment(s)</p>` : ""}
             ${actionButton("View in Chat", groupUrl)}`
          ),
          organizationId
        }).catch(() => {});
      }
    }

    revalidatePath("/chat");
    return { ok: true, data: { id: message._id.toString() }, message: "Sent" };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleReaction(messageId: string, emoji: string) {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    const message = await ChatMessage.findOne({ _id: messageId, organizationId });
    if (!message) throw new Error("Message not found");
    const existing = message.reactions.find((r: any) => r.userId.toString() === session.user.userId && r.emoji === emoji);
    if (existing) {
      message.reactions.pull({ _id: existing._id });
    } else {
      message.reactions.push({ emoji, userId: session.user.userId });
    }
    await message.save();
    revalidatePath("/chat");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteMessage(messageId: string) {
  try {
    const { session, organizationId } = await requireFeature("chatAccess");
    await connectToDatabase();
    const message = await ChatMessage.findOne({ _id: messageId, organizationId });
    if (!message) throw new Error("Message not found");
    if (message.senderId.toString() !== session.user.userId && !["owner", "admin"].includes(session.user.role)) {
      throw new Error("Not authorized to delete this message");
    }
    for (const att of message.attachments || []) {
      try {
        const bucket = await getReceiptBucket();
        await bucket.delete(new mongo.ObjectId(att.fileId));
      } catch {}
    }
    await message.deleteOne();
    revalidatePath("/chat");
    return { ok: true, message: "Deleted" };
  } catch (error) {
    return actionError(error);
  }
}

export async function leaveGroup(groupId: string) {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    await ChatGroup.updateOne(
      { _id: groupId, organizationId },
      { $pull: { members: { userId: session.user.userId } } }
    );
    revalidatePath("/chat");
    return { ok: true, message: "Left group" };
  } catch (error) {
    return actionError(error);
  }
}

export async function markRead(groupId: string) {
  try {
    const { session, organizationId } = await requireTenant();
    await connectToDatabase();
    await ChatGroup.updateOne(
      { _id: groupId, organizationId, "members.userId": session.user.userId },
      { $set: { "members.$.lastReadAt": new Date() } }
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
