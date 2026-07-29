import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const journalLineSchema = new Schema(
  {
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const manualJournalEntrySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    voucherNumber: { type: String, default: "", trim: true, index: true },
    entryDate: { type: Date, required: true, index: true },
    memo: { type: String, required: true, trim: true },
    lines: { type: [journalLineSchema], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

manualJournalEntrySchema.index({ organizationId: 1, entryDate: -1 });
manualJournalEntrySchema.index({ organizationId: 1, voucherNumber: 1 });

export type ManualJournalEntryDocument = InferSchemaType<typeof manualJournalEntrySchema> & { _id: string };
export const ManualJournalEntry = (models.ManualJournalEntry || model("ManualJournalEntry", manualJournalEntrySchema)) as Model<any>;
