export type ShiftState =
  | "NONE"
  | "SHIFT_STARTED"
  | "WORKING"
  | "ON_BREAK"
  | "SHIFT_ENDED";

export type ShiftEventType =
  | "SHIFT_START"
  | "WORK_START"
  | "BREAK_START"
  | "BREAK_END"
  | "SHIFT_END";

const transitions: Record<ShiftState, ShiftEventType[]> = {
  NONE: ["SHIFT_START"],

  SHIFT_STARTED: ["WORK_START", "SHIFT_END"],

  WORKING: ["BREAK_START", "SHIFT_END"],

  ON_BREAK: ["BREAK_END"],

  SHIFT_ENDED: [],
};

export const validateShiftTransition = (
  currentState: ShiftState,
  nextEvent: ShiftEventType
) => {
  const allowedTransitions = transitions[currentState];

  if (!allowedTransitions.includes(nextEvent)) {
    throw new Error(
      `Invalid transition from ${currentState} to ${nextEvent}`
    );
  }

  return true;
};