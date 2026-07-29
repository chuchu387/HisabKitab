import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const invoiceLineSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0.01 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["draft", "sent", "partial", "paid", "void"], default: "draft", index: true },
    lines: { type: [invoiceLineSchema], default: [] },
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

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, status: 1, dueDate: 1 });

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & { _id: string };
export const Invoice = (models.Invoice || model("Invoice", invoiceSchema)) as Model<any>;
