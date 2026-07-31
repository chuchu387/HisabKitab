import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const payrollSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: String, required: true, index: true },
    baseSalary: { type: Number, default: 0 },
    allowances: [{ label: { type: String, default: "" }, amount: { type: Number, default: 0 } }],
    bonus: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    deductions: [{ label: { type: String, default: "" }, amount: { type: Number, default: 0 } }],
    advanceDeduction: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "approved", "paid"], default: "draft", index: true },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

payrollSchema.index({ organizationId: 1, month: 1, userId: 1 }, { unique: true });
payrollSchema.index({ organizationId: 1, month: 1, status: 1 });

export type PayrollDocument = InferSchemaType<typeof payrollSchema> & { _id: string };
export const Payroll = (models.Payroll || model("Payroll", payrollSchema)) as Model<any>;
