import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const taskFolderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    projectIds: [{ type: Schema.Types.ObjectId, ref: "Project", index: true }],
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

taskFolderSchema.index({ organizationId: 1, name: 1 }, { unique: true });
taskFolderSchema.index({ organizationId: 1, active: 1, createdAt: -1 });

export type TaskFolderDocument = InferSchemaType<typeof taskFolderSchema> & { _id: string };
export const TaskFolder = (models.TaskFolder || model("TaskFolder", taskFolderSchema)) as Model<any>;
