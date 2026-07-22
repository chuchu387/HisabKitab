import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const notificationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    href: { type: String, default: "/dashboard" },
    type: { type: String, default: "info", index: true },
    readAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, userId: 1, readAt: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & { _id: string };
export const Notification = (models.Notification || model("Notification", notificationSchema)) as Model<any>;
