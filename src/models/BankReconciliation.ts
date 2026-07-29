import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const bankReconciliationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    voucherNumber: { type: String, default: "", trim: true, index: true },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    statementDate: { type: Date, required: true, index: true },
    systemBalance: { type: Number, required: true },
    statementBalance: { type: Number, required: true },
    difference: { type: Number, required: true },
    note: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

bankReconciliationSchema.index({ organizationId: 1, statementDate: -1 });
bankReconciliationSchema.index({ organizationId: 1, bankAccountId: 1, statementDate: -1 });
bankReconciliationSchema.index({ organizationId: 1, voucherNumber: 1 });

export type BankReconciliationDocument = InferSchemaType<typeof bankReconciliationSchema> & { _id: string };
export const BankReconciliation = (models.BankReconciliation || model("BankReconciliation", bankReconciliationSchema)) as Model<any>;
