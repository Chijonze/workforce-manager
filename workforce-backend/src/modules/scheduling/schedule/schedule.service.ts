import Schedule from "../../../models/schedule.model";
import ShiftSession from "../../../models/ShiftSession";
import { normalizeToUtcDate } from "../enforcement/enforcement.utils";
import { hasApprovedLeave } from "../../leave/leave.service";

export const assignSchedule = async (data: any) => {
  const workDate = normalizeToUtcDate(data.workDate);

  if (await hasApprovedLeave(data.userId, workDate)) {
    throw new Error("Cannot assign a schedule on an approved leave day");
  }

  return await Schedule.create({
    ...data,
    workDate,
  });
};

export const getSchedules = async () => {
  return await Schedule.find().populate("shiftTemplateId");
};

export const getUserSchedule = async (userId: string) => {
  return await Schedule.find({ userId })
    .populate("shiftTemplateId")
    .sort({ workDate: -1 });
};

export const deleteSchedulesByDateRange = async (data: any) => {
  const userId = String(data.userId || "").trim();

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!data.startDate) {
    throw new Error("Start date is required");
  }

  const start = normalizeToUtcDate(data.startDate);
  const end = normalizeToUtcDate(data.endDate || data.startDate);

  if (end < start) {
    throw new Error("End date cannot be before start date");
  }

  const exclusiveEnd = new Date(end);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);

  const schedules = await Schedule.find({
    userId,
    workDate: { $gte: start, $lt: exclusiveEnd },
  });

  if (!schedules.length) {
    return { deletedCount: 0 };
  }

  const scheduleIds = schedules.map((schedule) => schedule._id);
  const linkedSession = await ShiftSession.findOne({
    scheduleId: { $in: scheduleIds },
  });

  if (linkedSession) {
    throw new Error("Cannot delete schedules that already have shift activity");
  }

  const result = await Schedule.deleteMany({
    _id: { $in: scheduleIds },
  });

  return { deletedCount: result.deletedCount || 0 };
};
