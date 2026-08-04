import { model, models, Schema, type Model } from "mongoose";

const chatMessageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: "ChatGroup", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["message", "call"], default: "message", index: true },
    callId: { type: Schema.Types.ObjectId, ref: "Call", default: null },
    callEvent: { type: String, enum: ["", "started", "joined", "ended", "declined"], default: "" },
    replyTo: { type: Schema.Types.ObjectId, ref: "ChatMessage", default: null },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attachments: [{
      name: { type: String, required: true },
      fileId: { type: Schema.Types.ObjectId, required: true },
      size: { type: Number, default: 0 },
      mimeType: { type: String, default: "application/octet-stream" }
    }],
    reactions: [{
      emoji: { type: String, required: true },
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true }
    }],
    readBy: [{
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      readAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

chatMessageSchema.index({ organizationId: 1, groupId: 1, createdAt: -1 });

export const ChatMessage = (models.ChatMessage || model("ChatMessage", chatMessageSchema)) as Model<any>;
