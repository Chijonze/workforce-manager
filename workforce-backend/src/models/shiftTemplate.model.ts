import mongoose, { Schema, Document } from "mongoose";

export type ScheduleType = "time_managed" | "fluid";

export interface IShiftTemplate extends Document {
  name: string;
  scheduleType: ScheduleType;
  startTime: string; // "08:00" — required for time_managed, unused for fluid
  endTime: string;   // "20:00" — required for time_managed, unused for fluid

  breaks: {
    label: string;
    type: "break" | "lunch";
    mode: "static" | "dynamic";
    startTime?: string;
    endTime?: string;
    durationMinutes: number;
  }[];

  activities: {
    label: string;
    type: "meeting" | "training" | "after_call_work";
    startTime?: string;
    endTime?: string;
    durationMinutes: number;
  }[];

  isActive: boolean;
}

const shiftTemplateSchema = new Schema<IShiftTemplate>(
  {
    name: { type: String, required: true },

    scheduleType: {
      type: String,
      enum: ["time_managed", "fluid"],
      default: "time_managed",
      index: true,
    },

    startTime: { type: String },
    endTime: { type: String },

    breaks: [
      {
        label: String,
        type: {
          type: String,
          enum: ["break", "lunch"],
          default: "break",
        },
        mode: {
          type: String,
          enum: ["static", "dynamic"],
          default: "static",
        },
        startTime: String,
        endTime: String,
        durationMinutes: Number,
      },
    ],

    activities: [
      {
        label: String,
        type: {
          type: String,
          enum: ["meeting", "training", "after_call_work"],
          required: true,
        },
        startTime: String,
        endTime: String,
        durationMinutes: Number,
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.ShiftTemplate || mongoose.model<IShiftTemplate>("ShiftTemplate", shiftTemplateSchema);
