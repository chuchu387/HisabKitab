import { model, models, Schema, type Model } from "mongoose";

const chatGroupSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    members: [{
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["admin", "member"], default: "member" },
      joinedAt: { type: Date, default: Date.now },
      lastReadAt: { type: Date, default: null },
      lastTypedAt: { type: Date, default: null }
    }],
    isDM: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

chatGroupSchema.index({ organizationId: 1, "members.userId": 1 });

export const ChatGroup = (models.ChatGroup || model("ChatGroup", chatGroupSchema)) as Model<any>;
