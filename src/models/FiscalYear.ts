import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const fiscalYearSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

fiscalYearSchema.index({ organizationId: 1, name: 1 }, { unique: true });
fiscalYearSchema.index({ organizationId: 1, startDate: 1, endDate: 1 });

export type FiscalYearDocument = InferSchemaType<typeof fiscalYearSchema> & { _id: string };
export const FiscalYear = (models.FiscalYear || model("FiscalYear", fiscalYearSchema)) as Model<any>;
