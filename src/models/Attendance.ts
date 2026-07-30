import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const attendanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, default: null },
    selfieId: { type: Schema.Types.ObjectId, default: null },
    ipAddress: { type: String, default: "" },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

attendanceSchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, date: 1, createdAt: -1 });

export type AttendanceDocument = InferSchemaType<typeof attendanceSchema> & { _id: string };
export const Attendance = (models.Attendance || model("Attendance", attendanceSchema)) as Model<any>;
