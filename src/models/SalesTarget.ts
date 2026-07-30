import { model, models, Schema, type Model } from "mongoose";

const salesTargetSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    month: { type: String, required: true, index: true },
    targetAmount: { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, default: 0, min: 0, max: 100 }, // percentage
    commissionFixed: { type: Number, default: 0, min: 0 }, // fixed per deal
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

salesTargetSchema.index({ organizationId: 1, userId: 1, month: 1 }, { unique: true });

export const SalesTarget = (models.SalesTarget || model("SalesTarget", salesTargetSchema)) as Model<any>;
