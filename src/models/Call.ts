import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const callParticipantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "" },
    status: { type: String, enum: ["invited", "accepted", "declined", "ended"], default: "invited" },
    joinedAt: { type: Date, default: null }
  },
  { _id: false }
);

const callMessageSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

const callSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: "ChatGroup", required: true, index: true },
    initiatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    initiatorName: { type: String, default: "" },
    mode: { type: String, enum: ["audio", "video"], default: "audio" },
    status: { type: String, enum: ["ringing", "active", "ended"], default: "ringing", index: true },
    participants: { type: [callParticipantSchema], default: [] },
    messages: { type: [callMessageSchema], default: [] },
    endedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    endedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

callSchema.index({ organizationId: 1, status: 1, "participants.userId": 1 });

export type CallDocument = InferSchemaType<typeof callSchema> & { _id: string };
export const Call = (models.Call || model("Call", callSchema)) as Model<any>;
