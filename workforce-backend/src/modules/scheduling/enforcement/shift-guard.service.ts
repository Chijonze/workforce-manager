import ShiftEvent from "../../../models/ShiftEvent";

import {
  ShiftState,
  ShiftEventType,
  validateShiftTransition,
} from "./shift-state-machine";

export const resolveCurrentShiftState = async (
  shiftId: string
): Promise<ShiftState> => {
  const events = await ShiftEvent.find({ shiftId }).sort({
    createdAt: 1,
  });

  if (!events.length) {
    return "NONE";
  }

  const lastEvent = events[events.length - 1];

  switch (lastEvent.type) {
    case "SHIFT_START":
      return "SHIFT_STARTED";

    case "WORK_START":
      return "WORKING";

    case "BREAK_START":
      return "ON_BREAK";

    case "BREAK_END":
      return "WORKING";

    case "SHIFT_END":
      return "SHIFT_ENDED";

    default:
      return "NONE";
  }
};

export const guardShiftAction = async (
  shiftId: string,
  nextEvent: ShiftEventType
) => {
  const currentState = await resolveCurrentShiftState(
    shiftId
  );

  validateShiftTransition(currentState, nextEvent);

  return true;
};