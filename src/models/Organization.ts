import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { organizationStatuses } from "@/constants";

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    generalBudget: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: organizationStatuses, default: "active", index: true }
  },
  { timestamps: true }
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & { _id: string };
export const Organization = (models.Organization || model("Organization", organizationSchema)) as Model<any>;
