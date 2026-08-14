import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const purchaseOrderLineSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0.01 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    vendorName: { type: String, required: true, trim: true, index: true },
    vendorPan: { type: String, default: "", trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    orderNumber: { type: String, required: true, trim: true },
    orderDate: { type: Date, required: true, index: true },
    expectedBillDate: { type: Date, default: null, index: true },
    status: { type: String, enum: ["draft", "sent", "approved", "received", "converted", "cancelled"], default: "draft", index: true },
    taxable: { type: Boolean, default: false, index: true },
    lines: { type: [purchaseOrderLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    convertedApInvoiceId: { type: Schema.Types.ObjectId, ref: "ApInvoice", default: null, index: true },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ organizationId: 1, orderNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ organizationId: 1, status: 1, orderDate: -1 });
purchaseOrderSchema.index({ organizationId: 1, vendorName: 1, orderDate: -1 });

export type PurchaseOrderDocument = InferSchemaType<typeof purchaseOrderSchema> & { _id: string };
export const PurchaseOrder = (models.PurchaseOrder || model("PurchaseOrder", purchaseOrderSchema)) as Model<any>;
