import mongoose, { Schema, Document } from "mongoose";

export interface IShiftPolicy extends Document {
  name: string;
  shiftDurationMinutes: number;

  break1DurationMinutes: number;
  break2DurationMinutes: number;
}

const shiftPolicySchema = new Schema<IShiftPolicy>(
  {
    name: { type: String, required: true },

    shiftDurationMinutes: { type: Number, default: 720 }, // 12 hours

    break1DurationMinutes: { type: Number, required: true },
    break2DurationMinutes: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.ShiftPolicy || mongoose.model<IShiftPolicy>(
  "ShiftPolicy",
  shiftPolicySchema
);