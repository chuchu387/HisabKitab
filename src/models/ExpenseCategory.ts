import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const expenseCategorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

expenseCategorySchema.index({ organizationId: 1, name: 1 }, { unique: true });
export type ExpenseCategoryDocument = InferSchemaType<typeof expenseCategorySchema> & { _id: string };
export const ExpenseCategory = (models.ExpenseCategory || model("ExpenseCategory", expenseCategorySchema)) as Model<any>;
