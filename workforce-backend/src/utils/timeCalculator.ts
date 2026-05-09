import ShiftEvent from "../models/ShiftEvent";

export const calculateWorkTime = async (shiftId: string) => {
  const events = await ShiftEvent.find({ shiftId }).sort({
    createdAt: 1,
  });

  let totalWork = 0;
  let lastWorkStart: Date | null = null;

  for (const event of events) {
    if (event.type === "WORK_START") {
      lastWorkStart = event.timestamp;
    }

    if (event.type === "BREAK_START" && lastWorkStart) {
      totalWork +=
        (new Date(event.timestamp).getTime() -
          new Date(lastWorkStart).getTime()) /
        60000;

      lastWorkStart = null;
    }
  }

  return totalWork;
};