import Schedule from "../../../models/schedule.model";
import ShiftSession from "../../../models/ShiftSession";
import ShiftTemplate from "../../../models/shiftTemplate.model";
import type { ScheduleType } from "../../../models/shiftTemplate.model";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_BREAKS = 6;
const MAX_ACTIVITIES = 6;
const MIN_ACTIVITY_MINUTES = 1;
const MAX_ACTIVITY_MINUTES = 480;

const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Durations are computed with an overnight wrap so a 23:45 -> 00:15 window is
// 30 minutes, not 0. Sub-30-minute values must survive untouched: the previous
// client treated any computed 0 as "invalid" and silently substituted a
// stale/default duration, which is what corrupted small shift and break times.
const durationFromWindow = (startTime?: string, endTime?: string): number | null => {
  if (!startTime || !endTime) return null;

  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return null;

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const duration = (endMinutes - startMinutes + 1440) % 1440;

  // Equal times mean "not set" rather than a 24h/0h activity window.
  return duration === 0 ? null : duration;
};

const clampDuration = (value: unknown, fallback: number): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_ACTIVITY_MINUTES, Math.max(MIN_ACTIVITY_MINUTES, parsed));
};

const cleanLabel = (value: unknown, fallback: string): string => {
  const text = String(value ?? "").trim().slice(0, 80);
  return text || fallback;
};

type BreakInput = Record<string, any>;
type ActivityInput = Record<string, any>;

const validateBreaks = (rawBreaks: unknown, scheduleType: ScheduleType) => {
  if (rawBreaks === undefined || rawBreaks === null) return [];

  if (!Array.isArray(rawBreaks)) {
    throw new Error("Breaks must be a list");
  }

  if (rawBreaks.length > MAX_BREAKS) {
    throw new Error(`A template supports up to ${MAX_BREAKS} breaks`);
  }

  return rawBreaks.map((raw: BreakInput, index: number) => {
    const type = raw.type === "lunch" ? "lunch" : "break";
    const label = cleanLabel(raw.label, type === "lunch" ? "Lunch" : `Break ${index + 1}`);
    // Fluid shifts are not tied to a clock, so static windows make no sense.
    const requestedMode = raw.mode === "dynamic" ? "dynamic" : "static";
    const mode = scheduleType === "fluid" ? "dynamic" : requestedMode;

    if (mode === "dynamic") {
      return {
        label,
        type,
        mode,
        startTime: undefined,
        endTime: undefined,
        durationMinutes: clampDuration(raw.durationMinutes, 15),
      };
    }

    if (!TIME_PATTERN.test(String(raw.startTime || "")) || !TIME_PATTERN.test(String(raw.endTime || ""))) {
      throw new Error(`Break "${label}" needs a valid start and end time (HH:MM)`);
    }

    const duration = durationFromWindow(raw.startTime, raw.endTime);
    if (duration === null) {
      throw new Error(`Break "${label}" end time must be after its start time`);
    }

    return {
      label,
      type,
      mode,
      startTime: raw.startTime,
      endTime: raw.endTime,
      durationMinutes: duration,
    };
  });
};

const validateActivities = (rawActivities: unknown, scheduleType: ScheduleType) => {
  if (rawActivities === undefined || rawActivities === null) return [];

  if (!Array.isArray(rawActivities)) {
    throw new Error("Activities must be a list");
  }

  if (rawActivities.length > MAX_ACTIVITIES) {
    throw new Error(`A template supports up to ${MAX_ACTIVITIES} activities`);
  }

  const allowedTypes = ["meeting", "training", "after_call_work"];

  return rawActivities
    .filter((raw: ActivityInput) => allowedTypes.includes(String(raw.type)))
    .map((raw: ActivityInput) => {
      const type = String(raw.type);
      const label = cleanLabel(raw.label, type.replace(/_/g, " "));
      const fluid = scheduleType === "fluid";

      if (fluid || !raw.startTime || !raw.endTime) {
        return {
          label,
          type,
          startTime: undefined,
          endTime: undefined,
          durationMinutes: clampDuration(raw.durationMinutes, 30),
        };
      }

      if (!TIME_PATTERN.test(String(raw.startTime)) || !TIME_PATTERN.test(String(raw.endTime))) {
        throw new Error(`Activity "${label}" needs a valid start and end time (HH:MM)`);
      }

      const duration = durationFromWindow(raw.startTime, raw.endTime);

      return {
        label,
        type,
        startTime: raw.startTime,
        endTime: raw.endTime,
        durationMinutes: duration ?? clampDuration(raw.durationMinutes, 30),
      };
    });
};

const validateTemplatePayload = (data: any) => {
  const scheduleType: ScheduleType = data.scheduleType === "fluid" ? "fluid" : "time_managed";
  const name = cleanLabel(data.name, "");

  if (!name) {
    throw new Error("Template name is required");
  }

  let startTime: string | undefined;
  let endTime: string | undefined;

  if (scheduleType === "time_managed") {
    startTime = String(data.startTime || "");
    endTime = String(data.endTime || "");

    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      throw new Error("Shift start and end times are required (HH:MM)");
    }
  }

  return {
    name,
    scheduleType,
    startTime,
    endTime,
    breaks: validateBreaks(data.breaks, scheduleType),
    activities: validateActivities(data.activities, scheduleType),
  };
};

export const createTemplate = async (data: any) => {
  return await ShiftTemplate.create(validateTemplatePayload(data));
};

export const getTemplates = async (includeInactive = false) => {
  return await ShiftTemplate.find(includeInactive ? {} : { isActive: { $ne: false } });
};

export const getTemplateById = async (id: string) => {
  return await ShiftTemplate.findById(id);
};

export const updateTemplate = async (id: string, data: any) => {
  return await ShiftTemplate.findByIdAndUpdate(
    id,
    validateTemplatePayload(data),
    { new: true, runValidators: true }
  );
};

export const deleteTemplate = async (id: string) => {
  const assignedSchedule = await Schedule.findOne({ shiftTemplateId: id });
  const linkedSession = await ShiftSession.findOne({ shiftTemplateId: id });

  if (assignedSchedule || linkedSession) {
    return await ShiftTemplate.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
  }

  return await ShiftTemplate.findByIdAndDelete(id);
};
