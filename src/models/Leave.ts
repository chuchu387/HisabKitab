import { model, models, Schema, type Model } from "mongoose";

const leaveSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    reason: { type: String, default: "" },
    status: { type: String, enum: ["approved", "pending", "rejected"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

leaveSchema.index({ organizationId: 1, date: 1 });
leaveSchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });

export const Leave = (models.Leave || model("Leave", leaveSchema)) as Model<any>;
