import { model, models, Schema, type Model } from "mongoose";

const productSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    unitPrice: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "unit" },
    category: { type: String, default: "" },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

productSchema.index({ organizationId: 1, name: 1 }, { unique: true });
productSchema.index({ organizationId: 1, category: 1 });

export const Product = (models.Product || model("Product", productSchema)) as Model<any>;
