import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const auditLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { versionKey: false }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & { _id: string };
export const AuditLog = (models.AuditLog || model("AuditLog", auditLogSchema)) as Model<any>;
