import mongoose, { Schema, Document } from "mongoose";

export interface IShiftTemplate extends Document {
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "20:00"

  breaks: {
    label: string;
    type: "break" | "lunch";
    startTime?: string;
    endTime?: string;
    durationMinutes: number;
  }[];

  isActive: boolean;
}

const shiftTemplateSchema = new Schema<IShiftTemplate>(
  {
    name: { type: String, required: true },

    startTime: { type: String, required: true },
    endTime: { type: String, required: true },

    breaks: [
      {
        label: String,
        type: {
          type: String,
          enum: ["break", "lunch"],
          default: "break",
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
