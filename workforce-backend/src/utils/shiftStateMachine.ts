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

const availableTransitions: ShiftEventType[] = [
  "WORK_START",
  "BREAK_START",
  "LUNCH_START",
  "MEETING_START",
  "TRAINING_START",
  "AFTER_CALL_WORK_START",
  "SHIFT_END",
];

const allowedTransitions: Record<ShiftEventType, ShiftEventType[]> = {
  SHIFT_START: [
    ...availableTransitions,
  ],
  WORK_START: [
    ...availableTransitions.filter((event) => event !== "WORK_START"),
  ],
  BREAK_START: ["BREAK_END"],
  BREAK_END: [...availableTransitions],
  LUNCH_START: ["LUNCH_END"],
  LUNCH_END: [...availableTransitions],
  MEETING_START: ["MEETING_END"],
  MEETING_END: [...availableTransitions],
  TRAINING_START: ["TRAINING_END"],
  TRAINING_END: [...availableTransitions],
  AFTER_CALL_WORK_START: ["AFTER_CALL_WORK_END"],
  AFTER_CALL_WORK_END: [...availableTransitions],
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
