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
    panNumber: { type: String, default: "", trim: true },
    vatRegistered: { type: Boolean, default: false, index: true },
    defaultVatRate: { type: Number, default: 13, min: 0 },
    vatEffectiveDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: organizationStatuses, default: "active", index: true },
    attendanceMode: { type: String, enum: ["selfie", "device"], default: "selfie", index: true },
    device: {
      deviceSn: { type: String, default: "", trim: true },
      pushSecret: { type: String, default: "", trim: true },
      deviceUrl: { type: String, default: "", trim: true },
      pollEnabled: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & { _id: string };
export const Organization = (models.Organization || model("Organization", organizationSchema)) as Model<any>;
