export type ShiftEventType =
  | "SHIFT_START"
  | "WORK_START"
  | "BREAK_START"
  | "BREAK_END"
  | "SHIFT_END";

const allowedTransitions: Record<ShiftEventType, ShiftEventType[]> = {
  SHIFT_START: ["WORK_START"],
  WORK_START: ["BREAK_START", "SHIFT_END"],
  BREAK_START: ["BREAK_END"],
  BREAK_END: ["WORK_START"],
  SHIFT_END: [],
};

export const validateTransition = (
  lastEvent: ShiftEventType | null,
  newEvent: ShiftEventType
) => {
  if (!lastEvent) {
    if (newEvent !== "SHIFT_START") {
      throw new Error("Shift must start first");
    }
    return true;
  }

  const allowed = allowedTransitions[lastEvent];

  if (!allowed.includes(newEvent)) {
    throw new Error(
      `Invalid transition from ${lastEvent} to ${newEvent}`
    );
  }

  return true;
};