import { model, models, Schema, type Model } from "mongoose";

const campaignSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    source: { type: String, default: "" },
    description: { type: String, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    budget: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

campaignSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Campaign = (models.Campaign || model("Campaign", campaignSchema)) as Model<any>;
