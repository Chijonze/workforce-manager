export type ShiftEventType =
  | "SHIFT_START"
  | "WORK_START"
  | "BREAK_START"
  | "BREAK_END"
  | "LUNCH_START"
  | "LUNCH_END"
  | "MEETING_START"
  | "MEETING_END"
  | "TRAINING_START"
  | "TRAINING_END"
  | "AFTER_CALL_WORK_START"
  | "AFTER_CALL_WORK_END"
  | "SHIFT_END";

const allowedTransitions: Record<ShiftEventType, ShiftEventType[]> = {
  SHIFT_START: [
    "WORK_START",
    "BREAK_START",
    "LUNCH_START",
    "MEETING_START",
    "TRAINING_START",
    "AFTER_CALL_WORK_START",
    "SHIFT_END",
  ],
  WORK_START: [
    "BREAK_START",
    "LUNCH_START",
    "MEETING_START",
    "TRAINING_START",
    "AFTER_CALL_WORK_START",
    "SHIFT_END",
  ],
  BREAK_START: ["BREAK_END"],
  BREAK_END: ["WORK_START"],
  LUNCH_START: ["LUNCH_END"],
  LUNCH_END: ["WORK_START"],
  MEETING_START: ["MEETING_END"],
  MEETING_END: ["WORK_START"],
  TRAINING_START: ["TRAINING_END"],
  TRAINING_END: ["WORK_START"],
  AFTER_CALL_WORK_START: ["AFTER_CALL_WORK_END"],
  AFTER_CALL_WORK_END: ["WORK_START"],
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
