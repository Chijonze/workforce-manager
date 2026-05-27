export const BUSINESS_TIME_ZONE = "Europe/London";

const dateKeyFromParts = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getTimeZoneParts = (value: Date) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

export const getBusinessDateKey = (value: Date | string = new Date()) => {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return dateOnly[0];
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const parts = getTimeZoneParts(date);
  return dateKeyFromParts(parts.year, parts.month, parts.day);
};

export const normalizeToBusinessDate = (value: Date | string): Date => {
  const [year, month, day] = getBusinessDateKey(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const getBusinessOffsetMs = (utcDate: Date) => {
  const parts = getTimeZoneParts(utcDate);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  return localAsUtc - utcDate.getTime();
};

export const combineDateAndTime = (
  date: Date | string,
  time: string
): Date => {
  const [year, month, day] = getBusinessDateKey(date).split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  const offsetMs = getBusinessOffsetMs(localAsUtc);
  const corrected = new Date(localAsUtc.getTime() - offsetMs);
  const correctedOffsetMs = getBusinessOffsetMs(corrected);

  return new Date(localAsUtc.getTime() - correctedOffsetMs);
};

export const combineDateAndTimeRange = (
  date: Date | string,
  startTime: string,
  endTime: string
) => {
  const start = combineDateAndTime(date, startTime);
  let end = combineDateAndTime(date, endTime);

  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60000);
  }

  return { start, end };
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
