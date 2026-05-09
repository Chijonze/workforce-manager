export const combineDateAndTime = (
  date: Date,
  time: string
): Date => {
  const [hours, minutes] = time
    .split(":")
    .map(Number);

  const combined = new Date(date);

  combined.setHours(hours);
  combined.setMinutes(minutes);
  combined.setSeconds(0);
  combined.setMilliseconds(0);

  return combined;
};

export const addMinutes = (
  date: Date,
  minutes: number
): Date => {
  return new Date(
    date.getTime() + minutes * 60000
  );
};

export const differenceInMinutes = (
  laterDate: Date,
  earlierDate: Date
): number => {
  return Math.floor(
    (laterDate.getTime() -
      earlierDate.getTime()) /
      60000
  );
};

export const isWithinWindow = (
  current: Date,
  start: Date,
  end: Date
): boolean => {
  return (
    current.getTime() >= start.getTime() &&
    current.getTime() <= end.getTime()
  );
};