export const calculateLateMinutes = (
  actualClockIn: Date,
  scheduledStart: Date
): number => {
  const diff =
    actualClockIn.getTime() -
    scheduledStart.getTime();

  const minutes = Math.floor(diff / 60000);

  return minutes > 0 ? minutes : 0;
};

export const calculateOvertimeMinutes = (
  actualClockOut: Date,
  scheduledEnd?: Date
): number => {
  if (!scheduledEnd) return 0;

  const diff =
    actualClockOut.getTime() -
    scheduledEnd.getTime();

  const minutes = Math.floor(diff / 60000);

  return minutes > 0 ? minutes : 0;
};

export const determineAttendanceStatus = (
  lateMinutes: number
):
  | "on_time"
  | "late"
  | "early_exit"
  | "absent"
  | "overtime" => {
  if (lateMinutes > 0) {
    return "late";
  }

  return "on_time";
};