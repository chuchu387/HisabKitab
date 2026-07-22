import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { expenseApprovalStatuses } from "@/constants";

const expenseApprovalHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    expenseId: { type: Schema.Types.ObjectId, ref: "Expense", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvalStatus: { type: String, enum: expenseApprovalStatuses, required: true },
    note: { type: String, default: "" }
  },
  { timestamps: true }
);

expenseApprovalHistorySchema.index({ organizationId: 1, expenseId: 1, createdAt: -1 });

export type ExpenseApprovalHistoryDocument = InferSchemaType<typeof expenseApprovalHistorySchema> & { _id: string };
export const ExpenseApprovalHistory = (models.ExpenseApprovalHistory || model("ExpenseApprovalHistory", expenseApprovalHistorySchema)) as Model<any>;
