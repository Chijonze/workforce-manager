import Schedule from "../../../models/schedule.model";
import { normalizeToUtcDate } from "../enforcement/enforcement.utils";

export const assignSchedule = async (data: any) => {
  const workDate = normalizeToUtcDate(data.workDate);

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
