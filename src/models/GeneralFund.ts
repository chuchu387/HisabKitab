import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const generalFundSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    fundDate: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, default: "" },
    receiptImageId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

generalFundSchema.index({ organizationId: 1, fundDate: -1 });
generalFundSchema.index({ organizationId: 1, createdBy: 1, fundDate: -1 });
export type GeneralFundDocument = InferSchemaType<typeof generalFundSchema> & { _id: string };
export const GeneralFund = (models.GeneralFund || model("GeneralFund", generalFundSchema)) as Model<any>;
