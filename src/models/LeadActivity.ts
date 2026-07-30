import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { leadActivityTypes } from "@/constants";

const leadActivitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: leadActivityTypes, required: true, index: true },
    description: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

leadActivitySchema.index({ organizationId: 1, leadId: 1, createdAt: -1 });

export type LeadActivityDocument = InferSchemaType<typeof leadActivitySchema> & { _id: string };
export const LeadActivity = (models.LeadActivity || model("LeadActivity", leadActivitySchema)) as Model<any>;
