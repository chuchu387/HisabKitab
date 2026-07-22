import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export type PasswordResetTokenDocument = InferSchemaType<typeof passwordResetTokenSchema> & { _id: string };
export const PasswordResetToken = (models.PasswordResetToken || model("PasswordResetToken", passwordResetTokenSchema)) as Model<any>;
