import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const attendanceSettingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true, index: true },
    officeStartTime: { type: String, default: "10:00" },
    officeEndTime: { type: String, default: "18:00" },
    graceMinutes: { type: Number, default: 15, min: 0 },
    halfDayAfterMinutes: { type: Number, default: 240, min: 0 },
    workingDays: [{ type: Number, min: 0, max: 6 }],
    holidays: [{ type: String, trim: true }],
    reminderStartHour: { type: Number, default: 10, min: 0, max: 23 },
    reminderEndHour: { type: Number, default: 17, min: 0, max: 23 },
    reminderMaxPerDay: { type: Number, default: 8, min: 0, max: 24 },
    remindersEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export type AttendanceSettingDocument = InferSchemaType<typeof attendanceSettingSchema> & { _id: string };
export const AttendanceSetting = (models.AttendanceSetting || model("AttendanceSetting", attendanceSettingSchema)) as Model<any>;
