import { businessTimeZone } from "./vision.config";

const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string) => {
  const cached = timeFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  timeFormatterCache.set(timeZone, formatter);
  return formatter;
};

/** `09:15` in the business time zone, used in captions and prompts. */
export const formatCaptureTime = (date: Date | string, timeZone = businessTimeZone()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "--:--";
  return formatterFor(timeZone).format(value);
};

export const formatWindow = (
  start: Date | string,
  end: Date | string,
  timeZone = businessTimeZone()
) => `${formatCaptureTime(start, timeZone)}–${formatCaptureTime(end, timeZone)}`;
