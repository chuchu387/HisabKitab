import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const salarySettingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    baseSalary: { type: Number, default: 0 },
    allowances: [{ label: { type: String, default: "" }, amount: { type: Number, default: 0 } }],
    overtimeRate: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

salarySettingSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export type SalarySettingDocument = InferSchemaType<typeof salarySettingSchema> & { _id: string };
export const SalarySetting = (models.SalarySetting || model("SalarySetting", salarySettingSchema)) as Model<any>;
