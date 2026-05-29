import mongoose, { Schema, Document } from "mongoose";

export interface IShiftSession extends Document {
  userId: string;

  scheduleId?: mongoose.Types.ObjectId;

  shiftTemplateId?: mongoose.Types.ObjectId;

  clockInTime: Date;

  clockOutTime?: Date;

  scheduledStartTime?: Date;

  scheduledEndTime?: Date;

  status: "active" | "completed" | "paused" | "expired";

  totalWorkedMinutes: number;

  totalBreakMinutes: number;

  lateMinutes?: number;

  overtimeMinutes?: number;

  scheduledMinutes?: number;

  kpiScore?: number;

  adherenceScore?: number;

  workScore?: number;

  punctualityScore?: number;

  activityAdherenceScore?: number;

  kpiEvaluatedAt?: Date;

  autoClosed?: boolean;

  closureReason?: "manual" | "auto_closed" | "missed_shift";

  attendanceStatus?:
    | "on_time"
    | "late"
    | "very_late"
    | "absent"
    | "overtime";

  createdAt?: Date;

  updatedAt?: Date;
}

const shiftSessionSchema = new Schema<IShiftSession>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "Schedule",
    },

    shiftTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftTemplate",
    },

    clockInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },

    clockOutTime: {
      type: Date,
      default: null,
    },

    scheduledStartTime: {
      type: Date,
    },

    scheduledEndTime: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["active", "completed", "paused", "expired"],
      default: "active",
      index: true,
    },

    totalWorkedMinutes: {
      type: Number,
      default: 0,
    },

    totalBreakMinutes: {
      type: Number,
      default: 0,
    },

    lateMinutes: {
      type: Number,
      default: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
    },

    scheduledMinutes: {
      type: Number,
      default: 0,
    },

    kpiScore: {
      type: Number,
      default: 0,
    },

    adherenceScore: {
      type: Number,
      default: 0,
    },

    workScore: {
      type: Number,
      default: 0,
    },

    punctualityScore: {
      type: Number,
      default: 0,
    },

    activityAdherenceScore: {
      type: Number,
      default: 0,
    },

    kpiEvaluatedAt: {
      type: Date,
    },

    autoClosed: {
      type: Boolean,
      default: false,
    },

    closureReason: {
      type: String,
      enum: ["manual", "auto_closed", "missed_shift"],
      default: "manual",
    },

    attendanceStatus: {
      type: String,
      enum: [
        "on_time",
        "late",
        "very_late",
        "absent",
        "overtime",
      ],
      default: "on_time",
    },
  },
  {
    timestamps: true,
  }
);

shiftSessionSchema.index({
  userId: 1,
  status: 1,
});

shiftSessionSchema.index({
  userId: 1,
  createdAt: -1,
});

export default mongoose.models.ShiftSession ||
  mongoose.model<IShiftSession>(
    "ShiftSession",
    shiftSessionSchema
  );
