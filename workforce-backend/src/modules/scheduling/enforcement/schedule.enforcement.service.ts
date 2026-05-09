import Schedule from "../../../models/schedule.model";
import ShiftSession from "../../../models/ShiftSession";
import { isWithinWindow, getUtcDayRange } from "./enforcement.utils";
import { EnforcementResult, AllowedAction } from "./enforcement.types";

export const enforceSchedule = async (
  userId: string,
  action: AllowedAction
): Promise<EnforcementResult> => {
  // 1. Get today's schedule
  const { start, end } = getUtcDayRange();

  const schedule = await Schedule.findOne({
    userId,
    workDate: {
      $gte: start,
      $lt: end,
    },
  }).populate("shiftTemplateId");

  if (!schedule) {
    return {
      allowed: false,
      reason: "No schedule assigned for today",
      violationType: "NO_SCHEDULE",
    };
  }

  const template: any = schedule.shiftTemplateId;

  // 2. SHIFT START RULE
  if (action === "SHIFT_START") {
    const allowed = isWithinWindow(
      template.startTime,
      template.endTime
    );

    if (!allowed) {
      return {
        allowed: false,
        reason: "Outside scheduled shift window",
        violationType: "OUTSIDE_SHIFT_WINDOW",
        schedule,
      };
    }

    const activeShift = await ShiftSession.findOne({
      userId,
      status: "active",
    });

    if (activeShift) {
      return {
        allowed: false,
        reason: "Shift already active",
        violationType: "SHIFT_ALREADY_ACTIVE",
      };
    }
  }

  // 3. BASIC PASS
  return {
    allowed: true,
    schedule,
  };
};
