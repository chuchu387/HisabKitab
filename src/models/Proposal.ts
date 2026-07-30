import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { proposalStatuses } from "@/constants";

const proposalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    lineItems: { type: [{ productId: { type: Schema.Types.ObjectId, ref: "Product" }, name: String, description: String, quantity: { type: Number, min: 0 }, unitPrice: { type: Number, min: 0 }, total: { type: Number, min: 0 } }], default: [] },
    status: { type: String, enum: proposalStatuses, default: "draft", index: true },
    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    convertedToClientId: { type: Schema.Types.ObjectId, ref: "Client", default: null },
    convertedToProjectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    convertedToInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    convertedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

proposalSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
proposalSchema.index({ organizationId: 1, leadId: 1 });

export type ProposalDocument = InferSchemaType<typeof proposalSchema> & { _id: string };
export const Proposal = (models.Proposal || model("Proposal", proposalSchema)) as Model<any>;
