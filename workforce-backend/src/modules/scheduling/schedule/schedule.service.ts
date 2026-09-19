import Schedule from "../../../models/schedule.model";
import ShiftSession from "../../../models/ShiftSession";
import { normalizeToUtcDate } from "../enforcement/enforcement.utils";
import { combineDateAndTime, combineDateAndTimeRange } from "../../../utils/scheduleTime";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Server-computed, timezone-correct schedule details. The worker dashboard used
// to reconstruct times from bare "HH:MM" strings and a UTC-midnight workDate,
// which is where short windows (30 minutes and below) got mangled. Resolving
// everything here gives both sides one source of truth.
const decorateSchedule = (schedule: any) => {
  const plain = schedule.toObject ? schedule.toObject() : { ...schedule };
  const template = plain.shiftTemplateId && typeof plain.shiftTemplateId === "object"
    ? plain.shiftTemplateId
    : null;

  if (!template) {
    return { ...plain, scheduleType: "time_managed" };
  }

  const scheduleType = template.scheduleType === "fluid" ? "fluid" : "time_managed";
  const hasClockWindow =
    scheduleType === "time_managed" &&
    TIME_PATTERN.test(String(template.startTime || "")) &&
    TIME_PATTERN.test(String(template.endTime || ""));

  let scheduledStartTime: string | undefined;
  let scheduledEndTime: string | undefined;
  let scheduledMinutes = 0;

  if (hasClockWindow) {
    const window = combineDateAndTimeRange(plain.workDate, template.startTime, template.endTime);
    scheduledStartTime = window.start.toISOString();
    scheduledEndTime = window.end.toISOString();
    scheduledMinutes = Math.max(
      0,
      Math.round((window.end.getTime() - window.start.getTime()) / 60000)
    );
  }

  const decorateWindows = (item: any) => {
    const decorated = { ...item };

    if (
      (decorated.mode || "static") === "static" &&
      TIME_PATTERN.test(String(decorated.startTime || "")) &&
      TIME_PATTERN.test(String(decorated.endTime || ""))
    ) {
      const startAt = combineDateAndTime(plain.workDate, decorated.startTime);
      const endMinutesOfDay = parseTimeToMinutes(decorated.endTime);
      const startMinutesOfDay = parseTimeToMinutes(decorated.startTime);
      const endAt = combineDateAndTime(
        plain.workDate,
        decorated.endTime
      );

      // A static window ending before it starts is treated as crossing midnight.
      const resolvedEnd = endMinutesOfDay <= startMinutesOfDay
        ? new Date(endAt.getTime() + 24 * 60 * 60000)
        : endAt;

      decorated.startAt = startAt.toISOString();
      decorated.endAt = resolvedEnd.toISOString();
      // Recomputed here so legacy templates with corrupted durations heal
      // themselves instead of showing the bad value forever.
      decorated.durationMinutes = Math.max(
        1,
        Math.round((resolvedEnd.getTime() - startAt.getTime()) / 60000)
      );
    } else {
      decorated.startAt = undefined;
      decorated.endAt = undefined;
      const duration = Math.round(Number(decorated.durationMinutes) || 0);
      // 0 is a valid allowance ("work through, no break"); only absent values
      // resolve to undefined.
      decorated.durationMinutes = duration >= 0 && Number.isFinite(Number(decorated.durationMinutes))
        ? Math.min(480, Math.max(0, duration))
        : undefined;
    }

    return decorated;
  };

  return {
    ...plain,
    scheduleType,
    scheduledStartTime,
    scheduledEndTime,
    scheduledMinutes,
    shiftTemplateId: {
      ...template,
      breaks: (template.breaks || []).map(decorateWindows),
      activities: (template.activities || []).map(decorateWindows),
    },
  };
};

export const assignSchedule = async (data: any) => {
  const rawDates = Array.isArray(data.workDates) && data.workDates.length
    ? data.workDates
    : [data.workDate];
  const uniqueDates: string[] = Array.from(new Set(rawDates.filter(Boolean).map(String)));

  if (!data.userId) {
    throw new Error("User ID is required");
  }

  if (!data.shiftTemplateId) {
    throw new Error("Shift template is required");
  }

  if (!uniqueDates.length) {
    throw new Error("At least one work date is required");
  }

  const schedules = await Promise.all(
    uniqueDates.map((date) => {
      const workDate = normalizeToUtcDate(date);

      return Schedule.findOneAndUpdate(
        { userId: data.userId, workDate },
        {
          userId: data.userId,
          shiftTemplateId: data.shiftTemplateId,
          workDate,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    })
  );

  return schedules;
};

export const getSchedules = async () => {
  return await Schedule.find().populate("shiftTemplateId");
};

export const getUserSchedule = async (userId: string) => {
  const schedules = await Schedule.find({ userId })
    .populate("shiftTemplateId")
    .sort({ workDate: -1 });

  return schedules.map((schedule: any) => decorateSchedule(schedule));
};

export const deleteSchedulesByDateRange = async (data: any) => {
  const userId = String(data.userId || "").trim();

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!data.startDate) {
    throw new Error("Start date is required");
  }

  const start = normalizeToUtcDate(data.startDate);
  const end = normalizeToUtcDate(data.endDate || data.startDate);

  if (end < start) {
    throw new Error("End date cannot be before start date");
  }

  const exclusiveEnd = new Date(end);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);

  const schedules = await Schedule.find({
    userId,
    workDate: { $gte: start, $lt: exclusiveEnd },
  });

  if (!schedules.length) {
    return { deletedCount: 0 };
  }

  const scheduleIds = schedules.map((schedule) => schedule._id);
  const linkedSession = await ShiftSession.findOne({
    scheduleId: { $in: scheduleIds },
  });

  if (linkedSession) {
    throw new Error("Cannot delete schedules that already have shift activity");
  }

  const result = await Schedule.deleteMany({
    _id: { $in: scheduleIds },
  });

  return { deletedCount: result.deletedCount || 0 };
};
