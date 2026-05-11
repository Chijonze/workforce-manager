import LeaveRequest from "../../models/LeaveRequest";
import { normalizeToUtcDate } from "../scheduling/enforcement/enforcement.utils";

export const requestLeave = async (userId: string, data: any) => {
  const startDate = normalizeToUtcDate(data.startDate);
  const endDate = normalizeToUtcDate(data.endDate);

  if (endDate < startDate) {
    throw new Error("End date cannot be before start date");
  }

  return LeaveRequest.create({
    userId,
    leaveType: data.leaveType,
    startDate,
    endDate,
    reason: data.reason,
  });
};

export const getMyLeave = async (userId: string) => {
  return LeaveRequest.find({ userId }).sort({ createdAt: -1 });
};

export const getLeaveRequests = async () => {
  return LeaveRequest.find().sort({ createdAt: -1 });
};

export const reviewLeave = async (
  requestId: string,
  reviewerId: string,
  data: any
) => {
  if (!["approved", "rejected"].includes(data.status)) {
    throw new Error("Review status must be approved or rejected");
  }

  const updated = await LeaveRequest.findByIdAndUpdate(
    requestId,
    {
      status: data.status,
      managerComment: data.managerComment,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("Leave request not found");
  }

  return updated;
};

export const hasApprovedLeave = async (userId: string, workDate: Date) => {
  const leave = await LeaveRequest.findOne({
    userId,
    status: "approved",
    startDate: { $lte: workDate },
    endDate: { $gte: workDate },
  });

  return Boolean(leave);
};
