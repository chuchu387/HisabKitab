import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const bankAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    accountNumber: { type: String, default: "", trim: true },
    type: { type: String, enum: ["cash", "bank", "wallet"], default: "bank", index: true },
    openingBalance: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

bankAccountSchema.index({ organizationId: 1, code: 1 }, { unique: true });
bankAccountSchema.index({ organizationId: 1, active: 1, name: 1 });

export type BankAccountDocument = InferSchemaType<typeof bankAccountSchema> & { _id: string };
export const BankAccount = (models.BankAccount || model("BankAccount", bankAccountSchema)) as Model<any>;
