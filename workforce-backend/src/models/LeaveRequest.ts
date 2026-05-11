import mongoose, { Schema, Document } from "mongoose";

export interface ILeaveRequest extends Document {
  userId: string;
  leaveType: "annual" | "sick" | "personal" | "unpaid" | "other";
  startDate: Date;
  endDate: Date;
  reason: string;
  status: "pending" | "approved" | "rejected";
  managerComment?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    userId: { type: String, required: true, index: true },
    leaveType: {
      type: String,
      enum: ["annual", "sick", "personal", "unpaid", "other"],
      required: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    managerComment: { type: String, trim: true },
    reviewedBy: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

leaveRequestSchema.index({ userId: 1, startDate: 1, endDate: 1 });

export default mongoose.models.LeaveRequest ||
  mongoose.model<ILeaveRequest>("LeaveRequest", leaveRequestSchema);
