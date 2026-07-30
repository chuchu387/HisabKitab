import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { leadStatuses, leadSources } from "@/constants";

const leadSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "" },
    source: { type: String, enum: leadSources, default: "referral", index: true },
    status: { type: String, enum: leadStatuses, default: "new", index: true },
    estimatedValue: { type: Number, default: 0, min: 0 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    notes: { type: String, default: "" },
    followUpDate: { type: Date, default: null, index: true },
    convertedToClientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    convertedToProjectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    convertedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

leadSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
leadSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
leadSchema.index({ organizationId: 1, followUpDate: 1 });
leadSchema.index({ organizationId: 1, source: 1 });
leadSchema.index({ organizationId: 1, name: "text", company: "text", email: "text", notes: "text" });

export type LeadDocument = InferSchemaType<typeof leadSchema> & { _id: string };
export const Lead = (models.Lead || model("Lead", leadSchema)) as Model<any>;
