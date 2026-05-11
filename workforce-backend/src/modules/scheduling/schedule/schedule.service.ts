import Schedule from "../../../models/schedule.model";
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
