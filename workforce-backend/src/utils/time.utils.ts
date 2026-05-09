export const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const getCurrentMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const calculateMinuteDifference = (
  start: Date,
  end: Date
): number => {
  return Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60)
  );
};

export const isLateClockIn = (
  shiftStart: string,
  gracePeriodMinutes = 0
): boolean => {
  const currentMinutes = getCurrentMinutes();
  const shiftStartMinutes =
    parseTimeToMinutes(shiftStart) + gracePeriodMinutes;

  return currentMinutes > shiftStartMinutes;
};

export const calculateLateMinutes = (
  shiftStart: string
): number => {
  const currentMinutes = getCurrentMinutes();
  const shiftStartMinutes = parseTimeToMinutes(shiftStart);

  return Math.max(0, currentMinutes - shiftStartMinutes);
};

export const isOvertime = (
  shiftEnd: string
): boolean => {
  const currentMinutes = getCurrentMinutes();
  const shiftEndMinutes = parseTimeToMinutes(shiftEnd);

  return currentMinutes > shiftEndMinutes;
};

export const calculateOvertimeMinutes = (
  shiftEnd: string
): number => {
  const currentMinutes = getCurrentMinutes();
  const shiftEndMinutes = parseTimeToMinutes(shiftEnd);

  return Math.max(0, currentMinutes - shiftEndMinutes);
};