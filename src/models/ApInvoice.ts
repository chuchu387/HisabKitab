import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const apInvoiceLineSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0.01 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const apInvoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", default: null, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    vendorName: { type: String, required: true, trim: true, index: true },
    vendorPan: { type: String, default: "", trim: true },
    billNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["draft", "posted", "partial", "paid", "void"], default: "posted", index: true },
    taxable: { type: Boolean, default: false, index: true },
    lines: { type: [apInvoiceLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

apInvoiceSchema.index({ organizationId: 1, billNumber: 1, vendorName: 1 }, { unique: true });
apInvoiceSchema.index({ organizationId: 1, status: 1, dueDate: 1 });
apInvoiceSchema.index({ organizationId: 1, vendorName: 1, invoiceDate: -1 });

export type ApInvoiceDocument = InferSchemaType<typeof apInvoiceSchema> & { _id: string };
export const ApInvoice = (models.ApInvoice || model("ApInvoice", apInvoiceSchema)) as Model<any>;
