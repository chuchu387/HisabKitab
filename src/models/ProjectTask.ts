import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";
import { projectTaskStatuses } from "@/constants";

const projectTaskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: projectTaskStatuses, default: "to_do", index: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    estimatedHours: { type: Number, default: 0, min: 0 },
    imageId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

projectTaskSchema.index({ organizationId: 1, projectId: 1, status: 1 });
projectTaskSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
projectTaskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
projectTaskSchema.index({ organizationId: 1, title: "text", description: "text" });

export type ProjectTaskDocument = InferSchemaType<typeof projectTaskSchema> & { _id: string };
export const ProjectTask = (models.ProjectTask || model("ProjectTask", projectTaskSchema)) as Model<any>;
