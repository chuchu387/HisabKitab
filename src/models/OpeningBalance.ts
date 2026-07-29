import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const openingBalanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    fiscalYearId: { type: Schema.Types.ObjectId, ref: "FiscalYear", default: null, index: true },
    accountCode: { type: String, required: true, trim: true, index: true },
    accountName: { type: String, required: true, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

openingBalanceSchema.index({ organizationId: 1, fiscalYearId: 1, accountCode: 1 });

export type OpeningBalanceDocument = InferSchemaType<typeof openingBalanceSchema> & { _id: string };
export const OpeningBalance = (models.OpeningBalance || model("OpeningBalance", openingBalanceSchema)) as Model<any>;
