import { model, models, Schema, type Model } from "mongoose";

const commissionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    dealValue: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

commissionSchema.index({ organizationId: 1, userId: 1, status: 1 });
commissionSchema.index({ organizationId: 1, leadId: 1 }, { unique: true });

export const Commission = (models.Commission || model("Commission", commissionSchema)) as Model<any>;
