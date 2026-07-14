import mongoose, { now } from "mongoose";
import ShiftSession from "../../models/ShiftSession";
import ShiftEvent from "../../models/ShiftEvent";
import { validateTransition } from "../../utils/shiftStateMachine";
import Schedule from "../../models/schedule.model";
import ShiftTemplate from "../../models/shiftTemplate.model";
import { enforceBreakStart, enforceBreakEnd } from "../scheduling/enforcement/break.enforcement.service";
import { guardShiftAction } from "../scheduling/enforcement/shift-guard.service";

import { combineDateAndTimeRange } from "../../utils/scheduleTime";
import { getUtcDayRange } from "../scheduling/enforcement/enforcement.utils";

import {
  calculateLateMinutes,
  calculateOvertimeMinutes,
  determineAttendanceStatus,
} from "../../utils/attendanceCompliance";
import { persistShiftKpi } from "../execution/execution.service";

// Debug logging to verify models are loaded
console.log("ShiftSession model loaded:", !!ShiftSession);
console.log("ShiftEvent model loaded:", !!ShiftEvent);

// Validate models are properly imported before proceeding
if (!ShiftSession || !ShiftEvent) {
  console.error("Failed to load MongoDB models. ShiftSession:", !!ShiftSession, "ShiftEvent:", !!ShiftEvent);
  throw new Error("Failed to load MongoDB models. Check database connection and model exports.");
}

const calculateShiftTotals = (
  events: { type: string; timestamp: Date }[],
  closingTime: Date
) => {
  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;
  let lastWorkStart: Date | null = null;
  let lastBreakStart: Date | null = null;

  const timeline = [
    ...events,
    { type: "SHIFT_END", timestamp: closingTime },
  ];

  for (const event of timeline) {
    const timestamp = new Date(event.timestamp);

    if (
      [
        "SHIFT_START",
        "WORK_START",
        "BREAK_END",
        "LUNCH_END",
        "MEETING_END",
        "TRAINING_END",
        "AFTER_CALL_WORK_END",
      ].includes(event.type)
    ) {
      lastWorkStart = timestamp;
    }

    if (
      [
        "BREAK_START",
        "LUNCH_START",
        "MEETING_START",
        "TRAINING_START",
        "AFTER_CALL_WORK_START",
        "SHIFT_END",
      ].includes(event.type)
    ) {
      if (lastWorkStart) {
        totalWorkedMinutes += Math.floor(
          (timestamp.getTime() - lastWorkStart.getTime()) / 60000
        );
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
      totalBreakMinutes += Math.floor(
        (timestamp.getTime() - lastBreakStart.getTime()) / 60000
      );
      lastBreakStart = null;
    }

    if (event.type === "SHIFT_END" && lastWorkStart) {
      totalWorkedMinutes += Math.floor(
        (timestamp.getTime() - lastWorkStart.getTime()) / 60000
      );
      lastWorkStart = null;
    }
  }

  return { totalWorkedMinutes, totalBreakMinutes };
};

export const startShift = async (userId: string) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database not connected");
  }

  const activeShift = await ShiftSession.findOne({
    userId,
    status: "active",
  });

  if (activeShift) {
    throw new Error("Shift already active");
  }

  const now = new Date();
  const { start, end } = getUtcDayRange(now);

const schedule = await Schedule.findOne({
  userId,
  workDate: {
    $gte: start,
    $lt: end,
  },
});

  if (!schedule) {
    throw new Error("No schedule assigned for today");
  }

  // LOAD TEMPLATE
  const template = await ShiftTemplate.findById(
    schedule.shiftTemplateId
  );

  if (!template) {
    throw new Error("Shift template not found");
  }

  // BUILD REAL DATETIME WINDOWS
  const {
    start: scheduledStartTime,
    end: scheduledEndTime,
  } = combineDateAndTimeRange(
    schedule.workDate,
    template.startTime,
    template.endTime
  );

  if (now < scheduledStartTime || now > scheduledEndTime) {
    throw new Error("Shift can only be started during its scheduled window");
  }

  // LATE CALCULATION
  const lateMinutes = calculateLateMinutes(
    now,
    scheduledStartTime
  );

  const attendanceStatus =
    determineAttendanceStatus(lateMinutes);

  // CREATE SHIFT SESSION
  const session = await ShiftSession.create({
    userId,

    scheduleId: schedule._id,
    shiftTemplateId: template._id,

    clockInTime: now,

    scheduledStartTime,
    scheduledEndTime,

    status: "active",

    attendanceStatus,

    lateMinutes,

    totalWorkedMinutes: 0,
    totalBreakMinutes: 0,
    overtimeMinutes: 0,
  });

  // CREATE EVENT
  await ShiftEvent.create({
    shiftId: session._id,
    userId,
    type: "SHIFT_START",
    timestamp: now,

    metadata: {
      scheduled: true,
    },
  });

  return session;
};

export const startWork = async (userId: string, shiftId: string) => {
  // Validate shiftId format
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    throw new Error("Invalid shift ID format");
  }

  const shiftObjectId = new mongoose.Types.ObjectId(shiftId);

  // Validate shift exists and is active
  const shift = await ShiftSession.findOne({
    _id: shiftObjectId,
    userId,
  });
  if (!shift || shift.status !== "active") {
    throw new Error("No active shift found");
  }
if (
  shift.attendanceStatus === "absent"
) {
  throw new Error(
    "Cannot start work on absent shift"
  );
}
  const lastEvent = await ShiftEvent.findOne({
    shiftId: shiftObjectId,
    userId,
  })
    .sort({ createdAt: -1 });

  if (!lastEvent || lastEvent.type === "SHIFT_END") {
    throw new Error("Invalid shift state");
  }

  if (lastEvent.type === "WORK_START") {
    throw new Error("Already in work state");
  }

  const event = await ShiftEvent.create({
    shiftId,
    userId,
    type: "WORK_START",
    timestamp: new Date(),
  });

  return event;
};

export const startBreak = async (userId: string, shiftId: string) => {
  const check = await enforceBreakStart(userId, shiftId);

  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const event = await ShiftEvent.create({
    shiftId,
    userId,
    type: "BREAK_START",
    timestamp: new Date(),
  });

  return event;
};

export const endBreak = async (userId: string, shiftId: string) => {
  const check = await enforceBreakEnd(userId, shiftId);

  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const event = await ShiftEvent.create({
    shiftId,
    userId,
    type: "BREAK_END",
    timestamp: new Date(),
  });

  return event;
};

export const endShift = async (
  userId: string,
  shiftId: string
) => {
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    throw new Error("Invalid shift ID format");
  }

  const shiftObjectId =
    new mongoose.Types.ObjectId(shiftId);

  const shift = await ShiftSession.findOne({
    _id: shiftObjectId,
    userId,
  });

  if (!shift) {
    throw new Error("Shift not found");
  }

  const lastEvent = await ShiftEvent.findOne({
    shiftId: shiftObjectId,
    userId,
  }).sort({ createdAt: -1 });

  if (lastEvent?.type === "SHIFT_END") {
  throw new Error("Shift already ended");
}

if (
  lastEvent &&
  [
    "BREAK_START",
    "LUNCH_START",
    "MEETING_START",
    "TRAINING_START",
    "AFTER_CALL_WORK_START",
  ].includes(lastEvent.type)
) {
  throw new Error(
    "Return to Available before ending shift"
  );
}

  const now = new Date();
  const closingTime = shift.scheduledEndTime && now > shift.scheduledEndTime
    ? shift.scheduledEndTime
    : now;
  const events = await ShiftEvent.find({
    shiftId: shiftObjectId,
    userId,
  }).sort({ createdAt: 1 });
  const totals = calculateShiftTotals(events, closingTime);

  let attendanceStatus =
    shift.attendanceStatus;

  const session =
    await ShiftSession.findByIdAndUpdate(
      shiftObjectId,
      {
        status: "completed",
        clockOutTime: closingTime,

        overtimeMinutes: 0,
        totalWorkedMinutes: totals.totalWorkedMinutes,
        totalBreakMinutes: totals.totalBreakMinutes,

        attendanceStatus,
      },
      { new: true }
    );

  await ShiftEvent.create({
    shiftId,
    userId,
    type: "SHIFT_END",
    timestamp: closingTime,
  });

  return persistShiftKpi(shiftId, userId, closingTime);
};

export const createEvent = async (
  userId: string,
  shiftId: string,
  type:
    | "SHIFT_START"
    | "SHIFT_END"
    | "WORK_START"
    | "BREAK_START"
    | "BREAK_END"
    | "LUNCH_START"
    | "LUNCH_END"
    | "MEETING_START"
    | "MEETING_END"
    | "TRAINING_START"
    | "TRAINING_END"
    | "AFTER_CALL_WORK_START"
    | "AFTER_CALL_WORK_END"
) => {
  // Validate shiftId format
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    throw new Error("Invalid shift ID format");
  }

  const shiftObjectId = new mongoose.Types.ObjectId(shiftId);

  // Validate shift exists and is active (unless ending shift)
  if (type !== "SHIFT_END") {
    const shift = await ShiftSession.findOne({
      _id: shiftObjectId,
      userId,
    });
    if (!shift || shift.status !== "active") {
      throw new Error("No active shift found");
    }
  }

  const lastEvent = await ShiftEvent.findOne({
    shiftId: shiftObjectId,
    userId,
  })
    .sort({ createdAt: -1 });

  const lastType = lastEvent ? lastEvent.type : null;

  validateTransition(lastType, type);

  const event = await ShiftEvent.create({
    shiftId: shiftObjectId,
    userId,
    type,
    timestamp: new Date(),
  });

  return event;
};

export const startActivity = async (
  userId: string,
  shiftId: string,
  activityType:
    | "AVAILABLE"
    | "BREAK"
    | "LUNCH"
    | "MEETING"
    | "TRAINING"
    | "AFTER_CALL_WORK"
    | "END_SHIFT"
) => {
  if (!shiftId) {
    throw new Error("shiftId is required");
  }

  if (activityType === "END_SHIFT") {
    return endShift(userId, shiftId);
  }

  const lastEvent = await ShiftEvent.findOne({
    shiftId,
    userId,
  }).sort({ createdAt: -1 });

  const currentType = lastEvent?.type || null;
  const nextEventByActivity = {
    AVAILABLE:
      currentType === "BREAK_START"
        ? "BREAK_END"
        : currentType === "LUNCH_START"
          ? "LUNCH_END"
          : currentType === "MEETING_START"
            ? "MEETING_END"
            : currentType === "TRAINING_START"
              ? "TRAINING_END"
              : currentType === "AFTER_CALL_WORK_START"
                ? "AFTER_CALL_WORK_END"
                : "WORK_START",
    BREAK: "BREAK_START",
    LUNCH: "LUNCH_START",
    MEETING: "MEETING_START",
    TRAINING: "TRAINING_START",
    AFTER_CALL_WORK: "AFTER_CALL_WORK_START",
  } as const;

  const nextEvent = nextEventByActivity[activityType];

  if (!nextEvent) {
    throw new Error("Unsupported activity type");
  }

  return createEvent(userId, shiftId, nextEvent);
};

// Optional: Add helper function to get shift status
export const getShiftStatus = async (userId: string, shiftId: string) => {
  // Validate shiftId format
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    throw new Error("Invalid shift ID format");
  }

  const shiftObjectId = new mongoose.Types.ObjectId(shiftId);

  const shift = await ShiftSession.findOne({
    _id: shiftObjectId,
    userId,
  });
  if (!shift) {
    throw new Error("Shift not found");
  }

  const lastEvent = await ShiftEvent.findOne({
    shiftId: shiftObjectId,
    userId,
  })
    .sort({ createdAt: -1 });

  return {
    shiftStatus: shift.status,
    lastEventType: lastEvent?.type || null,
    clockInTime: shift.clockInTime,
    clockOutTime: shift.clockOutTime,
    totalWorkedMinutes: shift.totalWorkedMinutes,
    totalBreakMinutes: shift.totalBreakMinutes,
  };
};

// Optional: Add function to get all events for a shift
export const getShiftEvents = async (userId: string, shiftId: string) => {
  // Validate shiftId format
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    throw new Error("Invalid shift ID format");
  }

  const shiftObjectId = new mongoose.Types.ObjectId(shiftId);
  const shift = await ShiftSession.findOne({
    _id: shiftObjectId,
    userId,
  });

  if (!shift) {
    throw new Error("Shift not found");
  }

  const events = await ShiftEvent.find({
    shiftId: shiftObjectId,
    userId,
  }).sort({ createdAt: 1 });
  return events;
};

// Optional: Get active shift for a user
export const getActiveShift = async (userId: string) => {
  const activeShift = await ShiftSession.findOne({
    userId,
    status: "active",
  });
  
  if (!activeShift) {
    return null;
  }
  
  const lastEvent = await ShiftEvent.findOne({
    shiftId: activeShift._id,
    userId,
  })
    .sort({ createdAt: -1 });
  
  return {
    shift: activeShift,
    currentState: lastEvent?.type || null,
  };
};

console.log("Attendance service initialized successfully");
