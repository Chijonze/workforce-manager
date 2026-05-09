import ShiftEvent from "../../../models/ShiftEvent";
import ShiftSession from "../../../models/ShiftSession";

export const enforceBreakStart = async (
  userId: string,
  shiftId: string
) => {
  // 1. Get shift
  const shift = await ShiftSession.findOne({ _id: shiftId, userId });

  if (!shift || shift.status !== "active") {
    return {
      allowed: false,
      reason: "No active shift found",
    };
  }

  // 2. Get last event
  const lastEvent = await ShiftEvent.findOne({ shiftId, userId })
    .sort({ createdAt: -1 });

  if (!lastEvent) {
    return {
      allowed: false,
      reason: "Shift has no activity yet",
    };
  }

  // 3. MUST be working before break
  if (lastEvent.type !== "WORK_START") {
    return {
      allowed: false,
      reason: "You must be working before starting a break",
    };
  }

  return { allowed: true };
};

export const enforceBreakEnd = async (
  userId: string,
  shiftId: string
) => {
  const lastEvent = await ShiftEvent.findOne({ shiftId, userId })
    .sort({ createdAt: -1 });

  if (!lastEvent) {
    return {
      allowed: false,
      reason: "No shift activity found",
    };
  }

  // MUST be in break to end break
  if (lastEvent.type !== "BREAK_START") {
    return {
      allowed: false,
      reason: "No active break to end",
    };
  }

  return { allowed: true };
};
