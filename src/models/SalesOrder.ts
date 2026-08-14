import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const salesOrderLineSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0.01 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const salesOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    orderNumber: { type: String, required: true, trim: true },
    orderDate: { type: Date, required: true, index: true },
    expectedInvoiceDate: { type: Date, default: null, index: true },
    status: { type: String, enum: ["draft", "sent", "accepted", "converted", "cancelled"], default: "draft", index: true },
    vatApplicable: { type: Boolean, default: false, index: true },
    lines: { type: [salesOrderLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    convertedInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

salesOrderSchema.index({ organizationId: 1, orderNumber: 1 }, { unique: true });
salesOrderSchema.index({ organizationId: 1, status: 1, orderDate: -1 });

export type SalesOrderDocument = InferSchemaType<typeof salesOrderSchema> & { _id: string };
export const SalesOrder = (models.SalesOrder || model("SalesOrder", salesOrderSchema)) as Model<any>;
