import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const emailLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    recipients: [{ email: { type: String, required: true }, name: { type: String, default: "" } }],
    subject: { type: String, required: true },
    template: { type: String, default: "general", index: true },
    provider: { type: String, default: "brevo", index: true },
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true, index: true },
    responseStatus: { type: Number, default: null },
    responseBody: { type: String, default: "" },
    error: { type: String, default: "" },
    entityType: { type: String, default: "", index: true },
    entityId: { type: String, default: "", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

emailLogSchema.index({ organizationId: 1, createdAt: -1 });
emailLogSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
emailLogSchema.index({ organizationId: 1, template: 1, createdAt: -1 });

export type EmailLogDocument = InferSchemaType<typeof emailLogSchema> & { _id: string };
export const EmailLog = (models.EmailLog || model("EmailLog", emailLogSchema)) as Model<any>;
