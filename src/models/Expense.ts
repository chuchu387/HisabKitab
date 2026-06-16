import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const expenseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true, index: true },
    description: { type: String, required: true, trim: true },
    receiptImageId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

expenseSchema.index({ organizationId: 1, expenseDate: -1 });
expenseSchema.index({ organizationId: 1, projectId: 1 });
export type ExpenseDocument = InferSchemaType<typeof expenseSchema> & { _id: string };
export const Expense = (models.Expense || model("Expense", expenseSchema)) as Model<any>;
