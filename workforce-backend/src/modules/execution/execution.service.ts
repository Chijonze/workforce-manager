import Schedule from "../../models/schedule.model";
import ShiftEvent from "../../models/ShiftEvent";
import ShiftSession from "../../models/ShiftSession";
import ShiftTemplate from "../../models/shiftTemplate.model";
import MonitoringSession from "../../models/MonitoringSession";
import User from "../../models/User";
import { calculateOvertimeMinutes } from "../../utils/attendanceCompliance";
import { combineDateAndTimeRange } from "../../utils/scheduleTime";
import { hasApprovedLeave } from "../leave/leave.service";
import { endMonitoringSession } from "../monitoring/monitoring.service";
import { getUtcDayRange } from "../scheduling/enforcement/enforcement.utils";

type TimelineEvent = {
  type: string;
  timestamp: Date;
};

type ActivityType = "BREAK" | "LUNCH" | "MEETING" | "TRAINING" | "AFTER_CALL_WORK";

type ActivityInterval = {
  type: ActivityType;
  start: Date;
  end: Date;
};

type DynamicAllowance = {
  type: ActivityType;
  durationMinutes: number;
};

const clampPercent = (value: number) => {
  return Math.max(0, Math.min(100, Math.round(value)));
};

// A schedule defines expected hours, not a forced sign-out point. Keep an
// abandoned browser session bounded, while allowing legitimate overtime to be
// recorded and ended normally by the agent.
const MAX_ACTIVE_SHIFT_MINUTES = 12 * 60;

const minutesBetween = (start?: Date, end?: Date) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
};

const scheduledMinutesForSession = (session: any) => {
  return minutesBetween(session.scheduledStartTime, session.scheduledEndTime);
};

const scoreWindowForSession = (session: any, requestedClosingTime: Date) => {
  const scheduledStart = session.scheduledStartTime
    ? new Date(session.scheduledStartTime)
    : new Date(session.clockInTime);
  // Scheduled time is the KPI target, not a ceiling on recorded work. The old
  // ceiling silently discarded valid work after a short scheduled block.
  const closingTime = new Date(requestedClosingTime);

  return {
    start: scheduledStart,
    end: closingTime < scheduledStart ? scheduledStart : closingTime,
  };
};

const eventsWithinScoreWindow = (
  events: TimelineEvent[],
  start: Date,
  end: Date
): TimelineEvent[] =>
  events
    // Events received after a shift has closed must not be collapsed onto the
    // scheduled end. Doing so can turn a delayed WORK_START/BREAK_END into the
    // final state of the shift and overwrite the completed KPI with zeroes.
    .filter((event) => new Date(event.timestamp) <= end)
    .map((event) => {
      const timestamp = new Date(event.timestamp);
      return {
        // Mongoose documents do not expose schema fields through object spread.
        // Preserve the event type explicitly so the KPI state machine can
        // recognise work, break, and shift-end transitions.
        type: event.type,
        // A shift which started slightly before its scheduled window still
        // earns time only from the scheduled start onward.
        timestamp: new Date(Math.max(timestamp.getTime(), start.getTime())),
      };
    })
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());

const activityStartTypes: Partial<Record<string, ActivityType>> = {
  BREAK_START: "BREAK",
  LUNCH_START: "LUNCH",
  MEETING_START: "MEETING",
  TRAINING_START: "TRAINING",
  AFTER_CALL_WORK_START: "AFTER_CALL_WORK",
};

const activityEndTypes: Partial<Record<string, ActivityType>> = {
  BREAK_END: "BREAK",
  LUNCH_END: "LUNCH",
  MEETING_END: "MEETING",
  TRAINING_END: "TRAINING",
  AFTER_CALL_WORK_END: "AFTER_CALL_WORK",
};

const workStartTypes = new Set([
  "SHIFT_START",
  "WORK_START",
  "BREAK_END",
  "LUNCH_END",
  "MEETING_END",
  "TRAINING_END",
  "AFTER_CALL_WORK_END",
]);

const workStopTypes = new Set([
  "BREAK_START",
  "LUNCH_START",
  "MEETING_START",
  "TRAINING_START",
  "AFTER_CALL_WORK_START",
  "SHIFT_END",
]);

const getOverlapMinutes = (left: ActivityInterval, right: ActivityInterval) => {
  const start = Math.max(left.start.getTime(), right.start.getTime());
  const end = Math.min(left.end.getTime(), right.end.getTime());
  return Math.max(0, Math.floor((end - start) / 60000));
};

const getActivityIntervals = (
  events: TimelineEvent[],
  closingTime: Date
): ActivityInterval[] => {
  const activeStarts = new Map<ActivityType, Date>();
  const intervals: ActivityInterval[] = [];

  for (const event of events) {
    const startedType = activityStartTypes[event.type];
    const endedType = activityEndTypes[event.type];
    const timestamp = new Date(event.timestamp);

    if (startedType) {
      activeStarts.set(startedType, timestamp);
    }

    if (endedType) {
      const start = activeStarts.get(endedType);
      if (start && timestamp > start) {
        intervals.push({ type: endedType, start, end: timestamp });
      }
      activeStarts.delete(endedType);
    }
  }

  for (const [type, start] of activeStarts.entries()) {
    if (closingTime > start) {
      intervals.push({ type, start, end: closingTime });
    }
  }

  return intervals;
};

const getScheduledActivityIntervals = (
  session: any,
  template: any
): ActivityInterval[] => {
  const baseDate = session.scheduledStartTime || session.clockInTime;
  const typeByTemplateType: Record<string, ActivityType> = {
    meeting: "MEETING",
    training: "TRAINING",
    after_call_work: "AFTER_CALL_WORK",
  };
  const breakIntervals = (template.breaks || [])
    .filter((item: any) => (item.mode || "static") === "static" && item.startTime && item.endTime)
    .map((item: any) => {
      const { start, end } = combineDateAndTimeRange(baseDate, item.startTime, item.endTime);
      return {
        type: item.type === "lunch" ? "LUNCH" : "BREAK",
        start,
        end,
      };
    });
  const activityIntervals = (template.activities || [])
    .filter((item: any) => item.startTime && item.endTime && typeByTemplateType[item.type])
    .map((item: any) => {
      const { start, end } = combineDateAndTimeRange(baseDate, item.startTime, item.endTime);
      return {
        type: typeByTemplateType[item.type],
        start,
        end,
      };
    });

  return [...breakIntervals, ...activityIntervals];
};

const getDynamicBreakAllowances = (template: any): DynamicAllowance[] => {
  return (template.breaks || [])
    .filter((item: any) => (item.mode || "static") === "dynamic")
    .map((item: any) => ({
      type: item.type === "lunch" ? "LUNCH" : "BREAK",
      durationMinutes: Math.max(0, Math.round(Number(item.durationMinutes))),
    }))
    // Duration must be present; 0 is a real allowance ("work through, no
    // break") but an absent/legacy value means unconstrained for that type.
    .filter((item: DynamicAllowance) => Number.isFinite(item.durationMinutes));
};

const isFluidTemplate = (template: any) =>
  Boolean(template && (template.scheduleType === "fluid" || !template.startTime || !template.endTime));

// ---------------------------------------------------------------------------
// Activity conformance score (the "adherence" metric)
//
// Modern workforce software (NICE, Verint, Playvox) scores adherence from
// *unjustified off-productive time*: only minutes actually spent in an
// activity that the schedule did not grant reduce the score. Two consequences
// that fix the old zero-score bugs:
//   - time worked is never a violation, so workers who skip their breaks (or
//     work through on a 0-minute allowance) are not punished for being
//     productive;
//   - unused allowances contribute nothing to the denominator, so a worker
//     who stays within plan can never be diluted toward zero.
// ---------------------------------------------------------------------------
export const computeActivityConformanceScore = (
  scheduledIntervals: ActivityInterval[],
  allowances: DynamicAllowance[],
  actualIntervals: ActivityInterval[]
): { score: number; actualMinutes: number; matchedMinutes: number } => {
  const unconstrained = !scheduledIntervals.length && !allowances.length;
  const actualMinutes = actualIntervals.reduce(
    (sum, interval) => sum + minutesBetween(interval.start, interval.end),
    0
  );

  if (unconstrained || !actualMinutes) {
    return { score: 100, actualMinutes, matchedMinutes: 0 };
  }

  const staticByType = new Map<ActivityType, ActivityInterval[]>();
  for (const interval of scheduledIntervals) {
    const list = staticByType.get(interval.type) || [];
    list.push(interval);
    staticByType.set(interval.type, list);
  }

  // Sort actual intervals chronologically so the per-type allowance pool is
  // consumed in the order the worker actually took the time.
  const actualByType = new Map<ActivityType, ActivityInterval[]>();
  for (const interval of actualIntervals) {
    const list = actualByType.get(interval.type) || [];
    list.push(interval);
    actualByType.set(interval.type, list);
  }

  const allowanceByType = new Map<ActivityType, number>();
  for (const allowance of allowances) {
    allowanceByType.set(allowance.type, allowance.durationMinutes);
  }

  let matchedMinutes = 0;

  for (const [type, intervals] of actualByType.entries()) {
    let allowancePool = allowanceByType.get(type) ?? 0;
    const staticWindows = (staticByType.get(type) || []).sort(
      (left, right) => left.start.getTime() - right.start.getTime()
    );

    for (const interval of intervals.sort(
      (left, right) => left.start.getTime() - right.start.getTime()
    )) {
      const intervalMinutes = minutesBetween(interval.start, interval.end);
      if (!intervalMinutes) continue;

      let intervalMatched = 0;
      for (const window of staticWindows) {
        const overlap = getOverlapMinutes(interval, window);
        intervalMatched += overlap;
        if (intervalMatched >= intervalMinutes) break;
      }
      intervalMatched = Math.min(intervalMinutes, intervalMatched);

      const dynamicUsed = Math.min(allowancePool, intervalMinutes - intervalMatched);
      allowancePool -= dynamicUsed;
      intervalMatched += dynamicUsed;

      matchedMinutes += intervalMatched;
    }
  }

  return {
    score: clampPercent((matchedMinutes / actualMinutes) * 100),
    actualMinutes,
    matchedMinutes,
  };
};

// Fluid KPI runs from the first "Available" to "End shift". Work time is
// everything except breaks; the score is driven by focus (share of the session
// spent working) and break discipline.
const MIN_MOUSE_SAMPLES_FOR_ENGAGEMENT = 3;

// Fluid KPI: there is no fixed plan to conform to, so the score combines
//   - break discipline (activity conformance against the flexible allowances),
//   - engagement: the share of session minutes with recorded input activity
//     (mouse/keyboard via the monitoring stream). Without enough monitoring
//     data the fallback is time-based focus where only break time beyond the
//     allowance counts against the worker - working is never penalised.
const calculateFluidScore = async (
  session: any,
  template: any,
  events: TimelineEvent[],
  now = new Date()
) => {
  const scoreWindow = scoreWindowForSession(session, session.clockOutTime || now);
  const boundedEvents = eventsWithinScoreWindow(events, scoreWindow.start, scoreWindow.end);
  const totals = calculateShiftTotals(boundedEvents, scoreWindow.end);
  const workedMinutes = totals.totalWorkedMinutes;
  const breakMinutes = totals.totalBreakMinutes;
  const sessionMinutes = workedMinutes + breakMinutes;

  const breakConformance = computeActivityConformanceScore(
    [],
    getDynamicBreakAllowances(template),
    getActivityIntervals(boundedEvents, scoreWindow.end).filter(
      (interval) => interval.type === "BREAK" || interval.type === "LUNCH"
    )
  );
  const breakScore = breakConformance.score;

  if (session.attendanceStatus === "absent") {
    return {
      overall: 0,
      workScore: 0,
      punctualityScore: 0,
      breakScore: 0,
      activityAdherenceScore: 0,
      overtimePenalty: 0,
      scheduledMinutes: 0,
      workedMinutes: 0,
      breakMinutes: 0,
      evaluatedAt: scoreWindow.end,
    };
  }

  const monitoring = await MonitoringSession.findOne({
    shiftSessionId: session._id,
  }).select("mouseTotals.sampleCount");
  const sampleCount = Math.max(
    0,
    Math.round(Number(monitoring?.mouseTotals?.sampleCount) || 0)
  );

  let engagementScore: number;

  if (sessionMinutes > 0 && sampleCount >= MIN_MOUSE_SAMPLES_FOR_ENGAGEMENT) {
    // Minutes with recorded input over the whole session; clamped for the
    // brief window where browser and desktop agent both reported.
    engagementScore = clampPercent((sampleCount / sessionMinutes) * 100);
  } else {
    // Break time granted by the template is expected time off; only the part
    // beyond the allowance is unproductive.
    const unproductiveMinutes = Math.max(
      0,
      breakMinutes - breakConformance.matchedMinutes
    );
    engagementScore =
      workedMinutes + unproductiveMinutes > 0
        ? clampPercent(
            (workedMinutes / (workedMinutes + unproductiveMinutes)) * 100
          )
        : 0;
  }

  return {
    overall: clampPercent(engagementScore * 0.5 + breakScore * 0.5),
    workScore: engagementScore,
    punctualityScore: 100,
    breakScore,
    activityAdherenceScore: breakScore,
    overtimePenalty: 0,
    scheduledMinutes: 0,
    workedMinutes,
    breakMinutes,
    evaluatedAt: scoreWindow.end,
  };
};

const calculateActivityAdherenceScore = async (
  session: any,
  events: TimelineEvent[],
  closingTime: Date,
  preloadedTemplate?: any
) => {
  const template = preloadedTemplate
    ? preloadedTemplate
    : session.shiftTemplateId
      ? await ShiftTemplate.findById(session.shiftTemplateId)
      : null;

  if (!template) return 100;

  // Conformance semantics: only activity time the schedule did not grant
  // (outside static windows or beyond dynamic allowances) reduces the score.
  // Working - including skipping scheduled breaks - is never a violation, and
  // unused allowances never dilute the denominator, so a conforming worker
  // cannot be driven toward zero.
  return computeActivityConformanceScore(
    getScheduledActivityIntervals(session, template),
    getDynamicBreakAllowances(template),
    getActivityIntervals(events, closingTime)
  ).score;
};

export const calculateShiftTotals = (
  events: TimelineEvent[],
  closingTime: Date
) => {
  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;
  let lastWorkStart: Date | null = null;
  let lastBreakStart: Date | null = null;

  const timeline = [...events, { type: "SHIFT_END", timestamp: closingTime }];

  for (const event of timeline) {
    const timestamp = new Date(event.timestamp);

    if (workStartTypes.has(event.type)) {
      lastWorkStart = timestamp;
    }

    if (workStopTypes.has(event.type)) {
      if (lastWorkStart) {
        totalWorkedMinutes += minutesBetween(lastWorkStart, timestamp);
        lastWorkStart = null;
      }

      if (event.type === "BREAK_START" || event.type === "LUNCH_START") {
        lastBreakStart = timestamp;
      }
    }

    if (
      (event.type === "BREAK_END" || event.type === "LUNCH_END") &&
      lastBreakStart
    ) {
      totalBreakMinutes += minutesBetween(lastBreakStart, timestamp);
      lastBreakStart = null;
    }

    if (event.type === "SHIFT_END" && lastWorkStart) {
      totalWorkedMinutes += minutesBetween(lastWorkStart, timestamp);
      lastWorkStart = null;
    }
  }

  return { totalWorkedMinutes, totalBreakMinutes };
};

const calculateScore = async (
  session: any,
  events: TimelineEvent[],
  now = new Date()
) => {
  const template = session.shiftTemplateId
    ? await ShiftTemplate.findById(session.shiftTemplateId)
    : null;

  // Fluid shifts follow their own scoring model: there is no fixed schedule to
  // be punctual for and no scheduled-minute completion target.
  if (isFluidTemplate(template) || session.scheduleType === "fluid") {
    return await calculateFluidScore(session, template, events, now);
  }

  const scheduledMinutes = scheduledMinutesForSession(session);
  const scoreWindow = scoreWindowForSession(session, session.clockOutTime || now);
  const boundedEvents = eventsWithinScoreWindow(events, scoreWindow.start, scoreWindow.end);
  const liveTotals = calculateShiftTotals(boundedEvents, scoreWindow.end);
  const workedMinutes = liveTotals.totalWorkedMinutes;
  const breakMinutes = liveTotals.totalBreakMinutes;
  const activityAdherenceScore = await calculateActivityAdherenceScore(
    session,
    boundedEvents,
    scoreWindow.end,
    template
  );

  const workScore = scheduledMinutes
    ? clampPercent((workedMinutes / scheduledMinutes) * 100)
    : 0;
  const punctualityScore = clampPercent(100 - (session.lateMinutes || 0) * 3);
  const overtimePenalty = Math.min(20, session.overtimeMinutes || 0);
  const breakScore = activityAdherenceScore;

  if (session.attendanceStatus === "absent") {
    return {
      overall: 0,
      workScore: 0,
      punctualityScore: 0,
      breakScore: 0,
      activityAdherenceScore: 0,
      overtimePenalty: 0,
      scheduledMinutes,
      workedMinutes: 0,
      breakMinutes: 0,
      evaluatedAt: scoreWindow.end,
    };
  }

  return {
    overall: clampPercent(
      workScore * 0.45 +
        punctualityScore * 0.25 +
        activityAdherenceScore * 0.3 -
        overtimePenalty
    ),
    workScore,
    punctualityScore,
    breakScore,
    activityAdherenceScore,
    overtimePenalty,
    scheduledMinutes,
    workedMinutes,
    breakMinutes,
    evaluatedAt: scoreWindow.end,
  };
};

const kpiFieldsFromScore = (score: any) => ({
  scheduledMinutes: score.scheduledMinutes,
  totalWorkedMinutes: score.workedMinutes,
  totalBreakMinutes: score.breakMinutes,
  kpiScore: score.overall,
  adherenceScore: score.activityAdherenceScore,
  workScore: score.workScore,
  punctualityScore: score.punctualityScore,
  activityAdherenceScore: score.activityAdherenceScore,
  kpiEvaluatedAt: score.evaluatedAt,
});

export const persistShiftKpi = async (
  shiftId: string,
  userId?: string,
  closingTime = new Date()
) => {
  const session = await ShiftSession.findById(shiftId);

  if (!session) {
    throw new Error("Shift not found");
  }

  const events = await ShiftEvent.find({
    shiftId: session._id,
    ...(userId ? { userId } : {}),
  }).sort({ createdAt: 1 });

  const score = await calculateScore(session, events, closingTime);

  return ShiftSession.findByIdAndUpdate(
    session._id,
    kpiFieldsFromScore(score),
    { new: true }
  );
};

export const autoCloseExpiredShifts = async (now = new Date()) => {
  const maximumShiftStart = new Date(
    now.getTime() - MAX_ACTIVE_SHIFT_MINUTES * 60 * 1000
  );
  const activeShifts = await ShiftSession.find({
    status: "active",
    clockInTime: { $lte: maximumShiftStart },
  });

  let autoClosed = 0;

  for (const shift of activeShifts) {
    const closingTime = new Date(
      new Date(shift.clockInTime).getTime() + MAX_ACTIVE_SHIFT_MINUTES * 60 * 1000
    );
    const events = await ShiftEvent.find({
      shiftId: shift._id,
      userId: shift.userId,
    }).sort({ createdAt: 1 });

    const totals = calculateShiftTotals(events, closingTime);
    const overtimeMinutes = calculateOvertimeMinutes(
      closingTime,
      shift.scheduledEndTime
    );

    const closedShift = await ShiftSession.findOneAndUpdate({
      _id: shift._id,
      status: "active",
    }, {
      status: "expired",
      clockOutTime: closingTime,
      totalWorkedMinutes: totals.totalWorkedMinutes,
      totalBreakMinutes: totals.totalBreakMinutes,
      overtimeMinutes,
      autoClosed: true,
      closureReason: "auto_closed",
    }, { new: true });

    if (!closedShift) continue;

    await ShiftEvent.create({
      shiftId: shift._id,
      userId: shift.userId,
      type: "SHIFT_END",
      timestamp: closingTime,
      metadata: {
        violation: "AUTO_CLOSED",
      },
    });

    await persistShiftKpi(
      shift._id.toString(),
      shift.userId,
      closingTime
    );

    // Detached shifts must release their monitoring sessions too.
    await endMonitoringSession(shift._id.toString(), "expired").catch((error) => {
      console.error("Monitoring auto-close failed", error);
    });

    autoClosed += 1;
  }

  return autoClosed;
};

export const runExecutionMaintenance = async (now = new Date()) => {
  const autoClosed = await autoCloseExpiredShifts(now);

  const { start } = getUtcDayRange(now);
  const endedSchedules = await Schedule.find({
    workDate: { $lte: start },
  }).populate("shiftTemplateId");

  let missedShifts = 0;

  for (const schedule of endedSchedules) {
    if (await hasApprovedLeave(schedule.userId, schedule.workDate)) {
      continue;
    }

    const existingSession = await ShiftSession.findOne({
      scheduleId: schedule._id,
    });

    if (existingSession) continue;

    const template: any = schedule.shiftTemplateId;
    if (!template) continue;

    // Fluid shifts have no expected clock window, so they can never be
    // "missed" by the clock — a worker simply checks in when available.
    if ((template as any).scheduleType === "fluid" || !template.startTime || !template.endTime) {
      continue;
    }

    const {
      start: scheduledStartTime,
      end: scheduledEndTime,
    } = combineDateAndTimeRange(schedule.workDate, template.startTime, template.endTime);

    if (scheduledEndTime > now) continue;

    await ShiftSession.create({
      userId: schedule.userId,
      scheduleId: schedule._id,
      shiftTemplateId: template._id,
      clockInTime: scheduledStartTime,
      clockOutTime: scheduledEndTime,
      scheduledStartTime,
      scheduledEndTime,
      status: "completed",
      attendanceStatus: "absent",
      closureReason: "missed_shift",
      autoClosed: true,
      totalWorkedMinutes: 0,
      totalBreakMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      scheduledMinutes: minutesBetween(scheduledStartTime, scheduledEndTime),
      kpiScore: 0,
      adherenceScore: 0,
      workScore: 0,
      punctualityScore: 0,
      activityAdherenceScore: 0,
      kpiEvaluatedAt: now,
    });

    missedShifts += 1;
  }

  const { end } = getUtcDayRange(now);
  const todaysSessions = await ShiftSession.find({
    $or: [
      { scheduledStartTime: { $gte: start, $lt: end } },
      { clockInTime: { $gte: start, $lt: end } },
    ],
  });

  let recalculatedSessions = 0;

  for (const session of todaysSessions) {
    await persistShiftKpi(
      session._id.toString(),
      session.userId,
      session.clockOutTime || now
    );
    recalculatedSessions += 1;
  }

  return { autoClosed, missedShifts, recalculatedSessions };
};

export const getDailyPerformance = async (
  userId: string,
  date: Date | string = new Date()
) => {
  const { start, end } = getUtcDayRange(date);
  const approvedLeave = await hasApprovedLeave(userId, start);

  const schedule = await Schedule.findOne({
    userId,
    workDate: { $gte: start, $lt: end },
  }).populate("shiftTemplateId");

  const session = await ShiftSession.findOne({
    userId,
    $or: [
      { scheduledStartTime: { $gte: start, $lt: end } },
      { clockInTime: { $gte: start, $lt: end } },
    ],
  }).sort({ createdAt: -1 });

  const scheduleType = (schedule?.shiftTemplateId as any)?.scheduleType;

  if (approvedLeave) {
    return {
      date: start,
      scheduled: Boolean(schedule),
      status: "approved_leave",
      scheduleType,
      overallScore: 100,
      kpiScore: 100,
      adherenceScore: 100,
      workedMinutes: 0,
      scheduledMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      breakdown: {
        workScore: 100,
        punctualityScore: 100,
        breakScore: 100,
        activityAdherenceScore: 100,
      },
    };
  }

  if (!schedule && !session) {
    return {
      date: start,
      scheduled: false,
      status: "unscheduled",
      overallScore: 0,
      workedMinutes: 0,
      scheduledMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      breakdown: {
        workScore: 0,
        punctualityScore: 0,
        breakScore: 0,
        activityAdherenceScore: 0,
      },
    };
  }

  if (!session) {
    const template: any = schedule?.shiftTemplateId;
    const hasClockWindow = Boolean(
      template && template.scheduleType !== "fluid" && template.startTime && template.endTime
    );
    const scheduleWindow = template && hasClockWindow
      ? combineDateAndTimeRange(schedule!.workDate, template.startTime, template.endTime)
      : undefined;
    const scheduledStartTime = scheduleWindow?.start;
    const scheduledEndTime = scheduleWindow?.end;
    const missed = scheduledEndTime ? scheduledEndTime < new Date() : false;

    return {
      date: start,
      scheduled: Boolean(schedule),
      status: missed ? "missed" : "scheduled",
      scheduleType: (template as any)?.scheduleType,
      // A scheduled shift is not evidence of completed work. Scores must only
      // reflect server-recorded shift activity, never the absence of a session.
      overallScore: 0,
      kpiScore: 0,
      adherenceScore: 0,
      workedMinutes: 0,
      // Fluid shifts are unscheduled by definition; there is no target minute count.
      scheduledMinutes: minutesBetween(scheduledStartTime, scheduledEndTime),
      breakMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      breakdown: {
        workScore: 0,
        punctualityScore: 0,
        breakScore: 0,
        activityAdherenceScore: 0,
      },
    };
  }

  const events = await ShiftEvent.find({
    shiftId: session._id,
    userId,
  }).sort({ createdAt: 1 });

  if (session.status === "active") {
    const totals = calculateShiftTotals(events, new Date());
    session.totalWorkedMinutes = totals.totalWorkedMinutes;
    session.totalBreakMinutes = totals.totalBreakMinutes;
  }

  // A closed shift is a historical record. Its KPI is calculated and saved at
  // close time, so do not re-score it later using the current time/template.
  const hasPersistedKpi = Boolean(session.kpiEvaluatedAt);
  const score = hasPersistedKpi && session.status !== "active"
    ? {
        overall: session.kpiScore ?? 0,
        workScore: session.workScore ?? 0,
        punctualityScore: session.punctualityScore ?? 0,
        breakScore: session.activityAdherenceScore ?? session.adherenceScore ?? 0,
        activityAdherenceScore: session.activityAdherenceScore ?? session.adherenceScore ?? 0,
        scheduledMinutes: session.scheduledMinutes ?? scheduledMinutesForSession(session),
        workedMinutes: session.totalWorkedMinutes ?? 0,
        breakMinutes: session.totalBreakMinutes ?? 0,
      }
    : await calculateScore(session, events, session.clockOutTime || new Date());

  return {
    date: start,
    scheduled: Boolean(schedule),
    status: session.attendanceStatus || session.status,
    scheduleType: (session as any).scheduleType || scheduleType,
    overallScore: score.overall,
    kpiScore: score.overall,
    adherenceScore: score.activityAdherenceScore,
    workedMinutes: score.workedMinutes,
    scheduledMinutes: score.scheduledMinutes,
    breakMinutes: score.breakMinutes,
    lateMinutes: session.lateMinutes || 0,
    overtimeMinutes: session.overtimeMinutes || 0,
    breakdown: {
      workScore: score.workScore,
      punctualityScore: score.punctualityScore,
      breakScore: score.breakScore,
      activityAdherenceScore: score.activityAdherenceScore,
    },
  };
};

export const getAdminOverview = async (date: Date | string = new Date(), currentUser?: any) => {
  await runExecutionMaintenance();

  const { start, end } = getUtcDayRange(date);
  const supervisor = currentUser?.role === "supervisor"
    ? await User.findById(currentUser.userId).select("assignedAgentIds")
    : null;
  const assignedAgentIds = (supervisor?.assignedAgentIds || []).map(String);
  const userQuery = supervisor
    ? { _id: { $in: assignedAgentIds }, role: "agent" }
    : {};
  const [users, schedules, sessions, activeShifts] = await Promise.all([
    User.find(userQuery).select("_id name email role"),
    Schedule.find({
      workDate: { $gte: start, $lt: end },
      ...(supervisor ? { userId: { $in: assignedAgentIds } } : {}),
    }).populate("shiftTemplateId"),
    ShiftSession.find({
      ...(supervisor ? { userId: { $in: assignedAgentIds } } : {}),
      $or: [
        { scheduledStartTime: { $gte: start, $lt: end } },
        { clockInTime: { $gte: start, $lt: end } },
      ],
    }),
    ShiftSession.find({ status: "active", ...(supervisor ? { userId: { $in: assignedAgentIds } } : {}) }),
  ]);

  const sessionByUser = new Map<string, any>();
  sessions.forEach((session: any) => sessionByUser.set(session.userId, session));

  const userPerformance = await Promise.all(
    users.map(async (user: any) => {
      const performance = await getDailyPerformance(user._id.toString(), start);
      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        performance,
      };
    })
  );

  const scheduledUserIds = new Set(schedules.map((schedule: any) => schedule.userId));
  const presentCount = sessions.filter(
    (session: any) => session.attendanceStatus !== "absent"
  ).length;
  const absentCount = sessions.filter(
    (session: any) => session.attendanceStatus === "absent"
  ).length;
  const lateCount = sessions.filter((session: any) =>
    ["late", "very_late"].includes(session.attendanceStatus)
  ).length;
  const overtimeCount = sessions.filter((session: any) => (session.overtimeMinutes || 0) > 0).length;
  const averagePerformance = userPerformance.length
    ? clampPercent(
        userPerformance.reduce((sum, item) => sum + item.performance.overallScore, 0) /
          userPerformance.length
      )
    : 0;
  const averageAdherence = userPerformance.length
    ? clampPercent(
        userPerformance.reduce(
          (sum, item) => sum + (item.performance.adherenceScore ?? 0),
          0
        ) / userPerformance.length
      )
    : 0;

  return {
    date: start,
    totals: {
      users: users.length,
      scheduled: schedules.length,
      active: activeShifts.length,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      overtime: overtimeCount,
      unscheduledUsers: users.length - scheduledUserIds.size,
      attendanceRate: schedules.length ? clampPercent((presentCount / schedules.length) * 100) : 0,
      averagePerformance,
      averageAdherence,
    },
    users: userPerformance,
    schedules,
  };
};

export const getAdminExecutionReport = async (
  startDate: Date | string,
  endDate: Date | string,
  currentUser?: any
) => {
  const { start } = getUtcDayRange(startDate);
  const { start: endStart } = getUtcDayRange(endDate);

  if (endStart < start) {
    throw new Error("End date must be on or after start date");
  }

  const dayCount = Math.floor((endStart.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount > 366) {
    throw new Error("Select a period of up to 366 days");
  }

  await runExecutionMaintenance();

  const supervisor = currentUser?.role === "supervisor"
    ? await User.findById(currentUser.userId).select("assignedAgentIds")
    : null;
  const assignedAgentIds = (supervisor?.assignedAgentIds || []).map(String);
  const userQuery = supervisor
    ? { _id: { $in: assignedAgentIds }, role: "agent" }
    : {};
  const users = await User.find(userQuery).select("_id name email role");
  const dates = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date;
  });

  const rows = (await Promise.all(
    dates.flatMap((date) => users.map(async (user: any) => {
      const performance = await getDailyPerformance(user._id.toString(), date);
      const invoiceWorkedMinutes = performance.workedMinutes > 420 && performance.workedMinutes <= 480
        ? 480
        : performance.workedMinutes;

      return {
        date,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        performance: { ...performance, invoiceWorkedMinutes },
      };
    }))
  )).filter((item) => item.performance.scheduled || item.performance.status !== "unscheduled");

  const totals = rows.reduce(
    (result, item) => {
      result.scheduledMinutes += item.performance.scheduledMinutes;
      result.workedMinutes += item.performance.workedMinutes;
      result.breakMinutes += item.performance.breakMinutes;
      result.lateMinutes += item.performance.lateMinutes;
      result.overtimeMinutes += item.performance.overtimeMinutes;
      result.adherenceTotal += item.performance.adherenceScore ?? 0;
      result.performanceTotal += item.performance.overallScore;
      return result;
    },
    { scheduledMinutes: 0, workedMinutes: 0, breakMinutes: 0, lateMinutes: 0, overtimeMinutes: 0, adherenceTotal: 0, performanceTotal: 0 }
  );

  return {
    startDate: start,
    endDate: endStart,
    totals: {
      records: rows.length,
      users: users.length,
      scheduledMinutes: totals.scheduledMinutes,
      workedMinutes: totals.workedMinutes,
      breakMinutes: totals.breakMinutes,
      lateMinutes: totals.lateMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      averageAdherence: rows.length ? clampPercent(totals.adherenceTotal / rows.length) : 0,
      averagePerformance: rows.length ? clampPercent(totals.performanceTotal / rows.length) : 0,
    },
    rows,
  };
};
