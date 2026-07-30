import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { leadTaskStatuses } from "@/constants";

const leadTaskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: leadTaskStatuses, default: "pending", index: true },
    dueDate: { type: Date, default: null, index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

leadTaskSchema.index({ organizationId: 1, leadId: 1, status: 1 });
leadTaskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
leadTaskSchema.index({ organizationId: 1, dueDate: 1 });

export type LeadTaskDocument = InferSchemaType<typeof leadTaskSchema> & { _id: string };
export const LeadTask = (models.LeadTask || model("LeadTask", leadTaskSchema)) as Model<any>;
