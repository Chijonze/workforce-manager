"use client";

import Link from "next/link";
import { CalendarDays, Eye, Trash2, X } from "lucide-react";
import type { LeaveRequest, Schedule, User } from "@/types/workforce";
import { formatDate } from "@/lib/api";
import {
  BUSINESS_TIME_ZONE,
  formatTimeRange,
  getScheduleTemplate,
  isDateInLeave,
  toDateKey,
} from "../shared";

export function WorkDateMultiPicker({
  leaveRequests,
  month,
  onChangeMonth,
  onToggleDate,
  selectedDates,
}: {
  leaveRequests: LeaveRequest[];
  month: string;
  selectedDates: string[];
  onChangeMonth: (month: string) => void;
  onToggleDate: (date: string) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0, 12));
  const leadingDays = monthStart.getDay();
  const totalCells = Math.ceil((leadingDays + monthEnd.getDate()) / 7) * 7;
  const selectedSet = new Set(selectedDates);

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    if (dayNumber < 1 || dayNumber > monthEnd.getDate()) return null;
    return new Date(Date.UTC(year, monthNumber - 1, dayNumber, 12));
  });

  function shiftMonth(offset: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1, 12));
    onChangeMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="field full work-date-picker">
      <div className="work-date-picker-head">
        <label>Work dates</label>
        <div className="picker-month-controls">
          <button aria-label="Previous month" type="button" onClick={() => shiftMonth(-1)}>
            Previous
          </button>
          <strong>
            {monthStart.toLocaleDateString(undefined, {
              month: "long",
              timeZone: BUSINESS_TIME_ZONE,
              year: "numeric",
            })}
          </strong>
          <button aria-label="Next month" type="button" onClick={() => shiftMonth(1)}>
            Next
          </button>
        </div>
      </div>
      <div className="calendar-weekdays compact">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="work-date-grid">
        {cells.map((date, index) => {
          if (!date) return <div className="work-date-cell empty" key={index} />;

          const key = toDateKey(date);
          const isSelected = selectedSet.has(key);
          const isLeave = leaveRequests.some((request) => isDateInLeave(date, request));

          return (
            <button
              className={`work-date-cell ${isSelected ? "selected" : ""} ${isLeave ? "leave" : ""}`}
              key={key}
              type="button"
              onClick={() => onToggleDate(key)}
            >
              <strong>{date.getUTCDate()}</strong>
              {isLeave && <span>Leave</span>}
            </button>
          );
        })}
      </div>
      <div className="selected-date-chips">
        {selectedDates.length ? (
          selectedDates.map((date) => (
            <button key={date} type="button" onClick={() => onToggleDate(date)}>
              {formatDate(date)}
              <X size={13} />
            </button>
          ))
        ) : (
          <span>No dates selected</span>
        )}
      </div>
    </div>
  );
}

export function ScheduleSummary({ schedules, users }: { schedules: Schedule[]; users: User[] }) {
  const todayKey = toDateKey(new Date());
  const londonToday = (() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
    );
    return { year: Number(parts.year), month: Number(parts.month) };
  })();
  const monthKey = `${londonToday.year}-${String(londonToday.month).padStart(2, "0")}`;
  const nextSevenEnd = new Date();
  nextSevenEnd.setDate(nextSevenEnd.getDate() + 7);

  const assignedUsers = new Set(schedules.map((schedule) => schedule.userId));
  const upcomingSchedules = schedules
    .filter((schedule) => toDateKey(schedule.workDate) >= todayKey)
    .sort((left, right) => toDateKey(left.workDate).localeCompare(toDateKey(right.workDate)));
  const monthCount = schedules.filter((schedule) => toDateKey(schedule.workDate).startsWith(monthKey)).length;
  const nextSevenCount = schedules.filter((schedule) => {
    const key = toDateKey(schedule.workDate);
    return key >= todayKey && key <= toDateKey(nextSevenEnd);
  }).length;
  const nextSchedule = upcomingSchedules[0];
  const nextTemplate = nextSchedule ? getScheduleTemplate(nextSchedule) : null;
  const nextMember = nextSchedule ? users.find((item) => item._id === nextSchedule.userId) : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={20} />
          <div>
            <h2>Schedule Summary</h2>
            <p className="panel-subtitle">Assigned work dates at a glance</p>
          </div>
        </div>
        <Link className="button secondary" href="/assignments">
          <Eye size={17} />
          View assignments
        </Link>
      </div>

      <div className="metrics compact">
        <div className="metric">
          <span>Total assignments</span>
          <strong>{schedules.length}</strong>
        </div>
        <div className="metric">
          <span>This month</span>
          <strong>{monthCount}</strong>
        </div>
        <div className="metric">
          <span>Next 7 days</span>
          <strong>{nextSevenCount}</strong>
        </div>
        <div className="metric">
          <span>Assigned users</span>
          <strong>{assignedUsers.size}</strong>
        </div>
      </div>

      {nextSchedule ? (
        <article className="record">
          <div className="record-row">
            <span className="record-title">{nextTemplate?.name || "Assigned shift"}</span>
            <span className="pill">{formatDate(nextSchedule.workDate)}</span>
          </div>
          <span className="muted">
            Next assignment: {nextMember?.name || `User ID: ${nextSchedule.userId}`}
          </span>
        </article>
      ) : (
        <p className="muted">No upcoming assignments.</p>
      )}
    </section>
  );
}

export function AssignedSchedules({
  onDeleteSchedule,
  schedules,
  users,
}: {
  onDeleteSchedule?: (schedule: Schedule) => void;
  schedules: Schedule[];
  users: User[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={20} />
          <div>
            <h2>Assigned Schedules</h2>
            <p className="panel-subtitle">Your assigned work dates</p>
          </div>
        </div>
      </div>

      <div className="record-list">
        {schedules.length ? (
          schedules.map((schedule) => {
            const template = getScheduleTemplate(schedule);
            const member = users.find((item) => item._id === schedule.userId);
            const scheduleType = schedule.scheduleType || template?.scheduleType || "time_managed";

            return (
              <article className="record" key={schedule._id}>
                <div className="record-row">
                  <span className="record-title">{template?.name || "Assigned shift"}</span>
                  <span className={`pill ${scheduleType === "fluid" ? "accent-pill" : ""}`}>
                    {scheduleType === "fluid" ? "Fluid" : formatDate(schedule.workDate)}
                  </span>
                </div>
                <span className="muted">
                  {scheduleType === "fluid"
                    ? `Fluid shift · ${formatDate(schedule.workDate)} · no fixed hours`
                    : `Scheduled window: ${template ? formatTimeRange(template.startTime, template.endTime) : "Time not set"}`}
                </span>
                <span className="muted">
                  {member ? `User: ${member.name}` : `User ID: ${schedule.userId}`}
                </span>
                {template?.activities?.length ? (
                  <span className="muted">
                    {template.activities
                      .map((activity) =>
                        activity.startAt
                          ? `${activity.label}: ${formatTimeRange(activity.startTime, activity.endTime)}`
                          : `${activity.label}: ${activity.durationMinutes}m allowance`
                      )
                      .join(" | ")}
                  </span>
                ) : null}
                {template?.breaks?.length ? (
                  <span className="muted">
                    {template.breaks
                      .map((breakItem) =>
                        `${breakItem.label}: ${
                          (breakItem.mode || "static") === "dynamic"
                            ? `Dynamic ${breakItem.durationMinutes}m`
                            : `${formatTimeRange(breakItem.startTime, breakItem.endTime)} (${breakItem.durationMinutes}m)`
                        }`
                      )
                      .join(" | ")}
                  </span>
                ) : null}
                {onDeleteSchedule && (
                  <button
                    className="button danger schedule-delete-button"
                    type="button"
                    onClick={() => onDeleteSchedule(schedule)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <p className="muted">No schedules assigned yet.</p>
        )}
      </div>
    </section>
  );
}
