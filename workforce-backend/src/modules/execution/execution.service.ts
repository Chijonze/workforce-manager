import Schedule from "../../models/schedule.model";
import ShiftEvent from "../../models/ShiftEvent";
import ShiftSession from "../../models/ShiftSession";
import ShiftTemplate from "../../models/shiftTemplate.model";
import User from "../../models/User";
import { calculateOvertimeMinutes } from "../../utils/attendanceCompliance";
import { combineDateAndTimeRange } from "../../utils/scheduleTime";
import { getUtcDayRange } from "../scheduling/enforcement/enforcement.utils";

type TimelineEvent = {
  type: string;
  timestamp: Date;
};

const AUTO_CLOSE_GRACE_MINUTES = 120;

const clampPercent = (value: number) => {
  return Math.max(0, Math.min(100, Math.round(value)));
};

const minutesBetween = (start?: Date, end?: Date) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
};

const scheduledMinutesForSession = (session: any) => {
  return minutesBetween(session.scheduledStartTime, session.scheduledEndTime);
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

    if (event.type === "WORK_START") {
      lastWorkStart = timestamp;
    }

    if (event.type === "BREAK_START") {
      if (lastWorkStart) {
        totalWorkedMinutes += minutesBetween(lastWorkStart, timestamp);
        lastWorkStart = null;
      }

      lastBreakStart = timestamp;
    }

    if (event.type === "BREAK_END" && lastBreakStart) {
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

const calculateScore = (session: any, now = new Date()) => {
  const scheduledMinutes = scheduledMinutesForSession(session);
  const workedMinutes =
    session.status === "active"
      ? session.totalWorkedMinutes || 0
      : session.totalWorkedMinutes || 0;
  const requiredBreakMinutes = 0;

  const workScore = scheduledMinutes
    ? clampPercent((workedMinutes / scheduledMinutes) * 100)
    : 0;
  const punctualityScore = clampPercent(100 - (session.lateMinutes || 0) * 3);
  const overtimePenalty = Math.min(20, session.overtimeMinutes || 0);
  const breakScore = requiredBreakMinutes ? 100 : 100;

  if (session.attendanceStatus === "absent") {
    return {
      overall: 0,
      workScore: 0,
      punctualityScore: 0,
      breakScore: 0,
      overtimePenalty: 0,
      scheduledMinutes,
      workedMinutes: 0,
      evaluatedAt: now,
    };
  }

  return {
    overall: clampPercent(workScore * 0.55 + punctualityScore * 0.3 + breakScore * 0.15 - overtimePenalty),
    workScore,
    punctualityScore,
    breakScore,
    overtimePenalty,
    scheduledMinutes,
    workedMinutes,
    evaluatedAt: now,
  };
};

export const runExecutionMaintenance = async (now = new Date()) => {
  const activeShifts = await ShiftSession.find({
    status: "active",
    scheduledEndTime: { $lte: new Date(now.getTime() - AUTO_CLOSE_GRACE_MINUTES * 60000) },
  });

  let autoClosed = 0;

  for (const shift of activeShifts) {
    const events = await ShiftEvent.find({
      shiftId: shift._id,
      userId: shift.userId,
    }).sort({ createdAt: 1 });

    const totals = calculateShiftTotals(events, shift.scheduledEndTime || now);
    const overtimeMinutes = calculateOvertimeMinutes(
      shift.scheduledEndTime || now,
      shift.scheduledEndTime
    );

    await ShiftSession.findByIdAndUpdate(shift._id, {
      status: "expired",
      clockOutTime: shift.scheduledEndTime || now,
      totalWorkedMinutes: totals.totalWorkedMinutes,
      totalBreakMinutes: totals.totalBreakMinutes,
      overtimeMinutes,
      autoClosed: true,
      closureReason: "auto_closed",
    });

    await ShiftEvent.create({
      shiftId: shift._id,
      userId: shift.userId,
      type: "SHIFT_END",
      timestamp: shift.scheduledEndTime || now,
      metadata: {
        violation: "AUTO_CLOSED",
      },
    });

    autoClosed += 1;
  }

  const { start } = getUtcDayRange(now);
  const endedSchedules = await Schedule.find({
    workDate: { $lte: start },
  }).populate("shiftTemplateId");

  let missedShifts = 0;

  for (const schedule of endedSchedules) {
    const existingSession = await ShiftSession.findOne({
      scheduleId: schedule._id,
    });

    if (existingSession) continue;

    const template: any = schedule.shiftTemplateId;
    if (!template) continue;

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
    });

    missedShifts += 1;
  }

  return { autoClosed, missedShifts };
};

export const getDailyPerformance = async (
  userId: string,
  date: Date | string = new Date()
) => {
  const { start, end } = getUtcDayRange(date);

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
      },
    };
  }

  if (!session) {
    const template: any = schedule?.shiftTemplateId;
    const scheduleWindow = template
      ? combineDateAndTimeRange(schedule!.workDate, template.startTime, template.endTime)
      : undefined;
    const scheduledStartTime = scheduleWindow?.start;
    const scheduledEndTime = scheduleWindow?.end;
    const missed = scheduledEndTime ? scheduledEndTime < new Date() : false;

    return {
      date: start,
      scheduled: true,
      status: missed ? "missed" : "scheduled",
      overallScore: missed ? 0 : 100,
      workedMinutes: 0,
      scheduledMinutes: minutesBetween(scheduledStartTime, scheduledEndTime),
      breakMinutes: 0,
      lateMinutes: 0,
      overtimeMinutes: 0,
      breakdown: {
        workScore: missed ? 0 : 100,
        punctualityScore: missed ? 0 : 100,
        breakScore: missed ? 0 : 100,
      },
    };
  }

  if (session.status === "active") {
    const events = await ShiftEvent.find({
      shiftId: session._id,
      userId,
    }).sort({ createdAt: 1 });
    const totals = calculateShiftTotals(events, new Date());
    session.totalWorkedMinutes = totals.totalWorkedMinutes;
    session.totalBreakMinutes = totals.totalBreakMinutes;
  }

  const score = calculateScore(session);

  return {
    date: start,
    scheduled: Boolean(schedule),
    status: session.attendanceStatus || session.status,
    overallScore: score.overall,
    workedMinutes: score.workedMinutes,
    scheduledMinutes: score.scheduledMinutes,
    breakMinutes: session.totalBreakMinutes || 0,
    lateMinutes: session.lateMinutes || 0,
    overtimeMinutes: session.overtimeMinutes || 0,
    breakdown: {
      workScore: score.workScore,
      punctualityScore: score.punctualityScore,
      breakScore: score.breakScore,
    },
  };
};

export const getAdminOverview = async (date: Date | string = new Date()) => {
  await runExecutionMaintenance();

  const { start, end } = getUtcDayRange(date);
  const [users, schedules, sessions, activeShifts] = await Promise.all([
    User.find().select("_id name email role"),
    Schedule.find({ workDate: { $gte: start, $lt: end } }).populate("shiftTemplateId"),
    ShiftSession.find({
      $or: [
        { scheduledStartTime: { $gte: start, $lt: end } },
        { clockInTime: { $gte: start, $lt: end } },
      ],
    }),
    ShiftSession.find({ status: "active" }),
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
    },
    users: userPerformance,
    schedules,
  };
};
