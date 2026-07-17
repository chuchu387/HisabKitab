import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { projectStatuses, projectTypes } from "@/constants";

const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    projectType: { type: String, enum: projectTypes, default: "client", index: true },
    totalBudget: { type: Number, required: true, min: 0 },
    receivedAmount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: projectStatuses, default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, code: 1 }, { unique: true });
projectSchema.index({ organizationId: 1, name: "text", code: "text" });
export type ProjectDocument = InferSchemaType<typeof projectSchema> & { _id: string };
export const Project = (models.Project || model("Project", projectSchema)) as Model<any>;
