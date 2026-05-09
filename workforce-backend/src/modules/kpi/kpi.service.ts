import ShiftSession from "../../models/ShiftSession";
import { calculateWorkTime } from "../../utils/timeCalculator";
import { calculateAdherence } from "../../utils/kpiCalculator";

export const generateKPI = async (shiftId: string) => {
  const session = await ShiftSession.findById(shiftId);

  if (!session) throw new Error("Shift not found");

  const workedMinutes = await calculateWorkTime(shiftId);

  const scheduledMinutes = 720; // 12 hours default

  const adherence = calculateAdherence(
    workedMinutes,
    scheduledMinutes
  );

  return {
    shiftId,
    workedMinutes,
    scheduledMinutes,
    adherence: Math.round(adherence),
  };
};