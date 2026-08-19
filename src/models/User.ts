import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { roles } from "@/constants";
import { featureKeys, type PermissionOverrides } from "@/constants/permissions";

const userSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: roles, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    taskPermissions: {
      canCreateTask: { type: Boolean, default: true },
      canAssignTask: { type: Boolean, default: false },
      canCreateFolder: { type: Boolean, default: false },
      canManageFolderProjects: { type: Boolean, default: false }
    },
    permissions: { type: Schema.Types.Mixed, default: {} },
    devicePin: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, role: 1 });
userSchema.index({ organizationId: 1, active: 1, name: 1 });
userSchema.index({ organizationId: 1, devicePin: 1 });
export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string };
export const User = (models.User || model("User", userSchema)) as Model<any>;
