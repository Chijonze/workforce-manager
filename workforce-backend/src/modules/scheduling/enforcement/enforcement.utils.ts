export const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const getCurrentMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const isWithinWindow = (start: string, end: string): boolean => {
  const now = getCurrentMinutes();
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);

  return now >= startMin && now <= endMin;
};

export const normalizeToUtcDate = (value: Date | string): Date => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid workDate");
  }

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0
  ));
};

export const getUtcDayRange = (value: Date | string = new Date()) => {
  const start = normalizeToUtcDate(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
};
