"use client";

import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock3,
  History,
  MousePointer2,
  TimerReset,
} from "lucide-react";
import type {
  ActiveShiftResponse,
  DailyPerformance,
  LeaveRequest,
  Schedule,
  ShiftEvent,
} from "@/types/workforce";
import type { MonitoringStats } from "@/lib/monitoring";
import { formatDateTime, formatDate } from "@/lib/api";
import {
  BUSINESS_TIME_ZONE,
  formatDuration,
  formatTimeRange,
  getScheduleTemplate,
  minutesBetween,
  scorePieStyle,
  toDateKey,
  eventLabels,
  ScoreBar,
} from "../shared";
import { AssignedSchedules } from "./SchedulePanels";

export const activityOptions = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BREAK", label: "Break" },
  { value: "LUNCH", label: "Lunch" },
  { value: "MEETING", label: "Meeting" },
  { value: "TRAINING", label: "Training" },
  { value: "AFTER_CALL_WORK", label: "After call work" },
  { value: "OFFLINE", label: "Offline" },
  { value: "END_SHIFT", label: "End shift" },
] as const;

export type ActivityState = (typeof activityOptions)[number]["value"];

export const allowedTransitions: Record<ActivityState, ActivityState[]> = {
  AVAILABLE: ["BREAK", "LUNCH", "MEETING", "TRAINING", "AFTER_CALL_WORK", "END_SHIFT"],
  BREAK: ["AVAILABLE"],
  LUNCH: ["AVAILABLE"],
  MEETING: ["AVAILABLE"],
  TRAINING: ["AVAILABLE"],
  AFTER_CALL_WORK: ["AVAILABLE"],
  OFFLINE: ["AVAILABLE"],
  END_SHIFT: [],
};

const terminalStartEvents = new Set<ShiftEvent["type"]>([
  "BREAK_START",
  "LUNCH_START",
  "MEETING_START",
  "TRAINING_START",
  "AFTER_CALL_WORK_START",
]);

export function getActivityFromEvent(eventType?: ShiftEvent["type"] | null): ActivityState {
  if (!eventType) return "OFFLINE";

  if (eventType === "SHIFT_END") return "END_SHIFT";
  if (eventType === "BREAK_START") return "BREAK";
  if (eventType === "LUNCH_START") return "LUNCH";
  if (eventType === "MEETING_START") return "MEETING";
  if (eventType === "TRAINING_START") return "TRAINING";
  if (eventType === "AFTER_CALL_WORK_START") return "AFTER_CALL_WORK";
  return "AVAILABLE";
}

export function getActivityStart(
  events: ShiftEvent[],
  currentActivity: ActivityState,
  activeShift: ActiveShiftResponse
) {
  if (!activeShift) return undefined;

  if (currentActivity === "AVAILABLE") {
    const lastTerminal = [...events]
      .reverse()
      .find((event) => !terminalStartEvents.has(event.type) && event.type !== "SHIFT_START");
    return lastTerminal?.timestamp || activeShift.shift.clockInTime;
  }

  const startEvent = [...events]
    .reverse()
    .find((event) => getActivityFromEvent(event.type) === currentActivity);
  return startEvent?.timestamp;
}

export function LiveExecutionPanel({
  activeShift,
  activityTone,
  attendanceTone,
  currentActivity,
  currentState,
  dailyPerformance,
  elapsedSeconds,
  isOvertimeActivity,
  loading,
  maxDuration,
  monitoring,
  remainingSeconds,
  selectedActivity,
  selectedTransitionAllowed,
  activeSchedule,
  onChangeActivity,
  onStartActivity,
}: {
  activeShift: ActiveShiftResponse;
  activityTone: Partial<Record<ActivityState, string>>;
  attendanceTone: string;
  currentActivity: ActivityState;
  currentState: string;
  dailyPerformance: DailyPerformance | null;
  elapsedSeconds: number;
  isOvertimeActivity: boolean;
  loading: boolean;
  maxDuration?: number;
  monitoring: MonitoringStats | null;
  remainingSeconds: number | null;
  selectedActivity: ActivityState;
  selectedTransitionAllowed: boolean;
  activeSchedule?: Schedule | null;
  onChangeActivity: (activity: ActivityState) => void;
  onStartActivity: () => void;
}) {
  const scheduleType =
    activeShift?.shift.scheduleType || activeSchedule?.scheduleType || "time_managed";
  const isFluid = scheduleType === "fluid";
  const template = activeSchedule ? getScheduleTemplate(activeSchedule) : null;

  return (
    <section className="panel live-execution-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Clock3 size={20} />
          <div>
            <h2>Live Shift Execution</h2>
            <p className="panel-subtitle">
              {isFluid
                ? "Fluid shift · KPI measured from Available to End shift"
                : "Time-managed shift · tracked against your assigned window"}
            </p>
          </div>
        </div>
        <div className="review-actions">
          {isFluid && <span className="pill accent-pill">Fluid</span>}
          {!isFluid && template && (
            <span className="pill muted-pill">
              {formatTimeRange(template.startTime, template.endTime)}
            </span>
          )}
          <span className={`pill ${activityTone[currentActivity] || attendanceTone}`}>
            {currentState}
          </span>
        </div>
      </div>

      <div className="execution-grid">
        <div className="activity-card">
          <div className="activity-head">
            <span>Current activity</span>
            {isOvertimeActivity && (
              <span className="pill danger">
                <AlertTriangle size={14} />
                Over allowance
              </span>
            )}
          </div>
          <strong>{currentState}</strong>
          <p>
            {maxDuration
              ? `${maxDuration} minute allowance`
              : activeShift
                ? isFluid
                  ? "Counts as worked time (breaks excluded)"
                  : "Tracked as productive availability"
                : "Select Available to check in"}
          </p>
          <div className={`countdown ${isOvertimeActivity ? "danger" : ""}`}>
            <TimerReset size={18} />
            {remainingSeconds === null
              ? formatDuration(elapsedSeconds)
              : remainingSeconds >= 0
                ? formatDuration(remainingSeconds)
                : `+${formatDuration(Math.abs(remainingSeconds))}`}
          </div>
        </div>

        <div className="activity-toggle">
          <div className="field">
            <label htmlFor="activity-select">Activity</label>
            <select
              id="activity-select"
              value={selectedActivity}
              onChange={(event) => onChangeActivity(event.target.value as ActivityState)}
            >
              {activityOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    option.value === "OFFLINE" ||
                    !allowedTransitions[currentActivity].includes(option.value)
                  }
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="button"
            disabled={loading || !selectedTransitionAllowed}
            type="button"
            onClick={onStartActivity}
          >
            {currentActivity === "OFFLINE" ? "Clock in" : "Switch activity"}
            {selectedActivity === "END_SHIFT" ? " (End shift)" : ""}
          </button>

          {!selectedTransitionAllowed && (
            <p className="validation-copy">
              Return to Available before moving to another activity. End shift is blocked from
              break, lunch, and auxiliary states.
            </p>
          )}
        </div>
      </div>

      {activeShift && (
        <div className="monitoring-strip">
          <div className="monitoring-strip-head">
            <MousePointer2 size={15} />
            <strong>Activity monitoring</strong>
            <span className={`pill ${monitoring?.running ? "success-pill" : "muted-pill"}`}>
              {monitoring?.running ? (monitoring.viaDesktopAgent ? "Recording · desktop agent" : "Recording") : "Paused"}
            </span>
          </div>
          <span className="muted">
            {monitoring?.viaDesktopAgent
              ? "Your desktop agent tracks activity across the whole computer until you end your shift."
              : "Mouse activity is tracked until you end your shift."}
            {monitoring?.capturesEnabled
              ? ` Automatic screenshots: ${monitoring.capturesTaken}${monitoring.capturePlan ? ` of ${monitoring.capturePlan}` : ""} taken.`
              : monitoring?.captureNotice
                ? ` ${monitoring.captureNotice}; screenshots are unavailable this session.`
                : " Setting up screenshots…"}
          </span>
        </div>
      )}

      <div className="metrics execution-metrics">
        <div className="metric">
          <span>{isFluid ? "Session started" : "Scheduled start"}</span>
          <strong>
            {isFluid
              ? formatDateTime(activeShift?.shift.clockInTime)
              : formatDateTime(activeShift?.shift.scheduledStartTime)}
          </strong>
        </div>
        <div className="metric">
          <span>Worked duration</span>
          <strong>
            {dailyPerformance?.workedMinutes ?? 0}m
          </strong>
        </div>
        <div className="metric">
          <span>Break and lunch</span>
          <strong>{activeShift?.shift.totalBreakMinutes ?? dailyPerformance?.breakMinutes ?? 0}m</strong>
        </div>
        <div className="metric">
          <span>Today adherence</span>
          <strong>{dailyPerformance?.adherenceScore ?? dailyPerformance?.overallScore ?? 0}%</strong>
        </div>
      </div>
    </section>
  );
}

export function MonthlyActivityCalendar({
  activeShift,
  dailyPerformance,
  events,
  leaveRequests,
  onSelectDay,
  schedules,
  selectedDay,
}: {
  activeShift: ActiveShiftResponse;
  dailyPerformance: DailyPerformance | null;
  events: ShiftEvent[];
  leaveRequests: LeaveRequest[];
  schedules: Schedule[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  const londonToday = (() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
    );
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
  })();
  const today = new Date(Date.UTC(londonToday.year, londonToday.month - 1, londonToday.day, 12));
  const monthStart = new Date(Date.UTC(londonToday.year, londonToday.month - 1, 1, 12));
  const monthEnd = new Date(Date.UTC(londonToday.year, londonToday.month, 0, 12));
  const leadingDays = monthStart.getDay();
  const totalCells = Math.ceil((leadingDays + monthEnd.getDate()) / 7) * 7;
  const scheduleKeys = new Set(schedules.map((schedule) => toDateKey(schedule.workDate)));
  const todayKey = toDateKey(today);
  const selectedSchedule = schedules.find((schedule) => toDateKey(schedule.workDate) === selectedDay);
  const selectedTemplate = selectedSchedule ? getScheduleTemplate(selectedSchedule) : null;
  const assignedBreaks = selectedTemplate?.breaks || [];
  const assignedActivities = selectedTemplate?.activities || [];
  const selectedLeave = leaveRequests.find((request) =>
    selectedDay ? isLeaveDay(selectedDay, request) : false
  );

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    if (dayNumber < 1 || dayNumber > monthEnd.getDate()) return null;
    return new Date(Date.UTC(londonToday.year, londonToday.month - 1, dayNumber, 12));
  });

  return (
    <section className="panel calendar-panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={20} />
          <div>
            <h2>Monthly Activity Calendar</h2>
            <p className="panel-subtitle">
              {today.toLocaleDateString(undefined, {
                month: "long",
                timeZone: BUSINESS_TIME_ZONE,
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <span className="pill">{dailyPerformance?.overallScore ?? 0}% today</span>
      </div>

      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month">
        {cells.map((date, index) => {
          if (!date) return <div className="calendar-day empty" key={index} />;

          const key = toDateKey(date);
          const isToday = key === todayKey;
          const isScheduled = scheduleKeys.has(key);
          const leave = leaveRequests.find((request) => isDateInLeaveSafe(date, request));
          const isSelected = selectedDay === key;

          return (
            <button
              className={`calendar-day ${isScheduled ? "scheduled" : ""} ${
                leave ? "leave-day" : ""
              } ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
            >
              <strong>{date.getDate()}</strong>
              {isScheduled && !leave && <span>Scheduled</span>}
              {isToday && !leave && <i>{dailyPerformance?.overallScore ?? 0}%</i>}
            </button>
          );
        })}
      </div>

      <div className="day-detail">
        <div className="record-row">
          <strong>{selectedDay ? formatDate(selectedDay) : "Select a date"}</strong>
          <span className={`pill ${selectedLeave ? "" : selectedSchedule ? "" : "warn"}`}>
            {selectedLeave ? "Leave / no shift" : selectedSchedule ? "Scheduled" : "Blank day"}
          </span>
        </div>
        <div className="day-detail-grid">
          <span>Shift</span>
          <strong>
            {selectedLeave
              ? "Approved leave"
              : selectedTemplate
                ? selectedTemplate.scheduleType === "fluid"
                  ? "Fluid shift · no fixed hours"
                  : `${formatTimeRange(selectedTemplate.startTime, selectedTemplate.endTime)}`
                : selectedSchedule
                  ? "Assigned shift"
                  : "No work expected"}
          </strong>
          <span>Logged activities</span>
          <strong>{selectedDay === todayKey ? events.length : 0}</strong>
          <span>Active hours</span>
          <strong>
            {selectedDay === todayKey && activeShift
              ? `${Math.round((activeShift.shift.totalWorkedMinutes || minutesBetween(activeShift.shift.clockInTime)) / 60)}h`
              : "-"}
          </strong>
          <span>Assigned breaks</span>
          <div className="assigned-breaks">
            {selectedLeave ? (
              <strong>No breaks on approved leave</strong>
            ) : assignedBreaks.length ? (
              assignedBreaks.map((breakItem, index) => (
                <div className="assigned-break" key={`${breakItem.label}-${index}`}>
                  <strong>{breakItem.label}</strong>
                  <span>
                    {(breakItem.type || "break") === "lunch" ? "Lunch" : "Break"} -{" "}
                    {(breakItem.mode || "static") === "dynamic"
                      ? `Dynamic - ${breakItem.durationMinutes}m anytime during shift`
                      : `${formatTimeRange(breakItem.startTime, breakItem.endTime)} - ${breakItem.durationMinutes}m`}
                  </span>
                </div>
              ))
            ) : (
              <strong>No assigned breaks</strong>
            )}
          </div>
          <span>Optional activities</span>
          <div className="assigned-breaks">
            {selectedLeave ? (
              <strong>No activities on approved leave</strong>
            ) : assignedActivities.length ? (
              assignedActivities.map((activity, index) => (
                <div className="assigned-break" key={`${activity.type}-${index}`}>
                  <strong>{activity.label}</strong>
                  <span>
                    {activity.startAt
                      ? `${formatTimeRange(activity.startTime, activity.endTime)} - ${activity.durationMinutes}m`
                      : `${activity.durationMinutes}m allowance`}
                  </span>
                </div>
              ))
            ) : (
              <strong>No optional activities</strong>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function isLeaveDay(dayKey: string, request: LeaveRequest) {
  return dayKey >= toDateKey(request.startDate) && dayKey <= toDateKey(request.endDate);
}

function isDateInLeaveSafe(date: Date, request: LeaveRequest) {
  return isLeaveDay(toDateKey(date), request);
}

export function ShiftEventsPanel({ events }: { events: ShiftEvent[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <History size={20} />
          <div>
            <h2>Shift Events</h2>
            <p className="panel-subtitle">Activity history for the active shift</p>
          </div>
        </div>
      </div>

      <div className="timeline">
        {events.length ? (
          events.map((event) => (
            <div className="event" key={event._id}>
              <div className="event-dot">
                <Activity size={15} />
              </div>
              <div>
                <strong>{eventLabels[event.type]}</strong>
                <span>{formatDateTime(event.timestamp)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No active shift events yet.</p>
        )}
      </div>
    </section>
  );
}

export function PerformancePanel({ performance }: { performance: DailyPerformance }) {
  const score = Math.max(0, Math.min(100, performance.overallScore));
  const isFluidDay = performance.scheduledMinutes === 0 && performance.workedMinutes > 0;

  return (
    <section className="panel performance-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={20} />
          <div>
            <h2>Daily Performance</h2>
            <p className="panel-subtitle">
              {formatDate(performance.date)} · {performance.status}
            </p>
          </div>
        </div>
        <span className={`pill ${score < 60 ? "danger" : score < 80 ? "warn" : ""}`}>
          {score}% overall
        </span>
      </div>

      <div className="performance-grid">
        <div
          aria-label={`Daily performance score ${score}%`}
          className="score-pie"
          style={scorePieStyle(score) as CSSProperties}
        >
          <div>
            <strong>{score}%</strong>
            <span>overall</span>
          </div>
        </div>

        <div className="metrics compact">
          <div className="metric">
            <span>Worked</span>
            <strong>{performance.workedMinutes}m</strong>
          </div>
          <div className="metric">
            <span>{isFluidDay ? "Target" : "Scheduled"}</span>
            <strong>{isFluidDay ? "Fluid" : `${performance.scheduledMinutes}m`}</strong>
          </div>
          <div className="metric">
            <span>Break</span>
            <strong>{performance.breakMinutes}m</strong>
          </div>
          <div className="metric">
            <span>Late</span>
            <strong>{performance.lateMinutes}m</strong>
          </div>
        </div>
      </div>

      <div className="score-bars">
        <ScoreBar label={isFluidDay ? "Focus (work share)" : "Work completion"} value={performance.breakdown.workScore} />
        {!isFluidDay && <ScoreBar label="Punctuality" value={performance.breakdown.punctualityScore} />}
        <ScoreBar
          label="Activity adherence"
          value={performance.breakdown.activityAdherenceScore ?? performance.breakdown.breakScore}
        />
      </div>
    </section>
  );
}
