import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { roles } from "@/constants";

const userSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true, index: true },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, role: 1 });
export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };
export const User = (models.User || model("User", userSchema)) as Model<any>;
