import mongoose, { Schema, Document } from "mongoose";

export interface ISchedule extends Document {
  userId: string;

  shiftTemplateId: mongoose.Types.ObjectId;

  workDate: Date;
}

const scheduleSchema = new Schema<ISchedule>(
  {
    userId: {
      type: String,
      required: true,
    },

    shiftTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftTemplate",
      required: true,
    },

    workDate: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

scheduleSchema.index({
  userId: 1,
  workDate: 1,
});

export default mongoose.models.Schedule ||
  mongoose.model<ISchedule>("Schedule", scheduleSchema);