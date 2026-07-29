import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const chartAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["asset", "liability", "equity", "revenue", "expense"], required: true, index: true },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

chartAccountSchema.index({ organizationId: 1, code: 1 }, { unique: true });
chartAccountSchema.index({ organizationId: 1, type: 1, code: 1 });

export type ChartAccountDocument = InferSchemaType<typeof chartAccountSchema> & { _id: string };
export const ChartAccount = (models.ChartAccount || model("ChartAccount", chartAccountSchema)) as Model<any>;
