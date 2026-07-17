import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const projectPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    paymentDate: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, default: "" },
    receiptImageId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

projectPaymentSchema.index({ organizationId: 1, paymentDate: -1 });
projectPaymentSchema.index({ organizationId: 1, projectId: 1, paymentDate: -1 });
export type ProjectPaymentDocument = InferSchemaType<typeof projectPaymentSchema> & { _id: string };
export const ProjectPayment = (models.ProjectPayment || model("ProjectPayment", projectPaymentSchema)) as Model<any>;
