import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const pushSubscriptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ organizationId: 1, userId: 1 });

export type PushSubscriptionDocument = InferSchemaType<typeof pushSubscriptionSchema> & { _id: string };
export const PushSubscription = (models.PushSubscription || model("PushSubscription", pushSubscriptionSchema)) as Model<any>;
