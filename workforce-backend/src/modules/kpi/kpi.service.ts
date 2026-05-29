import ShiftSession from "../../models/ShiftSession";
import { persistShiftKpi } from "../execution/execution.service";

export const generateKPI = async (shiftId: string) => {
  const session = await ShiftSession.findById(shiftId);

  if (!session) throw new Error("Shift not found");

  const scoredSession = await persistShiftKpi(
    shiftId,
    session.userId,
    session.clockOutTime || new Date()
  );

  return {
    shiftId,
    workedMinutes: scoredSession?.totalWorkedMinutes || 0,
    scheduledMinutes: scoredSession?.scheduledMinutes || 0,
    kpiScore: scoredSession?.kpiScore || 0,
    adherence: scoredSession?.adherenceScore || 0,
  };
};
