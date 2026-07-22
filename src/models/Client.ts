import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const clientSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

clientSchema.index({ organizationId: 1, code: 1 }, { unique: true });
clientSchema.index({ organizationId: 1, name: 1 });
clientSchema.index({ organizationId: 1, active: 1, name: 1 });

export type ClientDocument = InferSchemaType<typeof clientSchema> & { _id: string };
export const Client = (models.Client || model("Client", clientSchema)) as Model<any>;
