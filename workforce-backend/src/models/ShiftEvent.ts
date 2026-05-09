import mongoose, { Schema, Document } from "mongoose";

export interface IShiftEvent extends Document {
  shiftId: mongoose.Types.ObjectId;

  userId: string;

  type:
    | "SHIFT_START"
    | "WORK_START"
    | "BREAK_START"
    | "BREAK_END"
    | "SHIFT_END";

  timestamp: Date;

  metadata?: {
    breakLabel?: string;
    scheduled?: boolean;
    violation?: string;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

const shiftEventSchema = new Schema<IShiftEvent>(
  {
    shiftId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ShiftSession",
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "SHIFT_START",
        "WORK_START",
        "BREAK_START",
        "BREAK_END",
        "SHIFT_END",
      ],
      required: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },

    metadata: {
      breakLabel: String,
      scheduled: Boolean,
      violation: String,
    },
  },
  {
    timestamps: true,
  }
);

shiftEventSchema.index({
  shiftId: 1,
  createdAt: -1,
});

shiftEventSchema.index({
  shiftId: 1,
  timestamp: -1,
});

export default mongoose.models.ShiftEvent ||
  mongoose.model<IShiftEvent>(
    "ShiftEvent",
    shiftEventSchema
  );