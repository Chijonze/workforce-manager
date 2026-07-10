"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Home, RefreshCw } from "lucide-react";
import { apiRequest, formatDate } from "@/lib/api";
import type { Schedule, User } from "@/types/workforce";

const BUSINESS_TIME_ZONE = "Europe/London";

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function londonDateParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function toDateKey(value: Date | string) {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return dateOnly[0];
  }

  const date = value instanceof Date ? value : new Date(value);
  const parts = londonDateParts(date);
  return dateKeyFromParts(parts.year, parts.month, parts.day);
}

function addMonths(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = dateKeyFromParts(year, month, 1);
  const endDate = new Date(Date.UTC(year, month, 0, 12));
  return { start, end: toDateKey(endDate) };
}

export default function AssignmentsPage() {
  const todayParts = londonDateParts();
  const currentMonth = dateKeyFromParts(todayParts.year, todayParts.month, 1).slice(0, 7);
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [dateRange, setDateRange] = useState(() => monthBounds(currentMonth));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = window.localStorage.getItem("workforce_token");
    if (!savedToken) {
      setLoading(false);
      setError("Sign in as an admin to view assignments.");
      return;
    }

    setToken(savedToken);
    loadAssignments(savedToken);
  }, []);

  async function loadAssignments(authToken = token) {
    if (!authToken) return;

    setLoading(true);
    setError("");

    try {
      const currentUser = await apiRequest<User>("/api/auth/me", { token: authToken });
      if (currentUser.role !== "admin") {
        setError("Only admins can view assignment management.");
        setSchedules([]);
        setUsers([]);
        return;
      }

      const [scheduleList, userList] = await Promise.all([
        apiRequest<Schedule[]>("/api/scheduling/schedule", { token: authToken }),
        apiRequest<User[]>("/api/auth/users", { token: authToken }),
      ]);

      setSchedules(scheduleList);
      setUsers(userList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assignments.");
    } finally {
      setLoading(false);
    }
  }

  function applyMonth(nextMonth: string) {
    setMonth(nextMonth);
    setDateRange(monthBounds(nextMonth));
  }

  const filteredSchedules = useMemo(() => {
    return schedules
      .filter((schedule) => {
        const key = toDateKey(schedule.workDate);
        const matchesUser = userId ? schedule.userId === userId : true;
        return matchesUser && key >= dateRange.start && key <= dateRange.end;
      })
      .sort((left, right) => {
        const dateOrder = toDateKey(left.workDate).localeCompare(toDateKey(right.workDate));
        if (dateOrder !== 0) return dateOrder;
        const leftUser = users.find((item) => item._id === left.userId)?.name || "";
        const rightUser = users.find((item) => item._id === right.userId)?.name || "";
        return leftUser.localeCompare(rightUser);
      });
  }, [dateRange.end, dateRange.start, schedules, userId, users]);

  const assignmentDates = new Set(filteredSchedules.map((schedule) => toDateKey(schedule.workDate)));
  const selectedUser = users.find((item) => item._id === userId);
  const monthStart = new Date(`${month}-01T12:00:00Z`);
  const leadingDays = monthStart.getUTCDay();
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12));
  const totalCells = Math.ceil((leadingDays + monthEnd.getUTCDate()) / 7) * 7;
  const calendarCells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    if (dayNumber < 1 || dayNumber > monthEnd.getUTCDate()) return null;
    return dateKeyFromParts(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, dayNumber);
  });

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <CalendarDays size={20} />
            <div>
              <h1>Assigned Work Dates</h1>
              <p className="panel-subtitle">Calendar and period view for schedule assignments</p>
            </div>
          </div>
          <div className="review-actions">
            <Link className="button secondary" href="/">
              <Home size={17} />
              Dashboard
            </Link>
            <button className="button secondary" disabled={loading || !token} type="button" onClick={() => loadAssignments()}>
              <RefreshCw size={17} />
              Refresh
            </button>
          </div>
        </div>

        <div className="metrics compact">
          <div className="metric">
            <span>Visible assignments</span>
            <strong>{filteredSchedules.length}</strong>
          </div>
          <div className="metric">
            <span>Assignment dates</span>
            <strong>{assignmentDates.size}</strong>
          </div>
          <div className="metric">
            <span>Team member</span>
            <strong>{selectedUser?.name || "All"}</strong>
          </div>
          <div className="metric">
            <span>Period</span>
            <strong>{formatDate(dateRange.start)} - {formatDate(dateRange.end)}</strong>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="assignment-user">Team member</label>
            <select id="assignment-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">All users</option>
              {users.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name} ({member.email})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="assignment-start">From date</label>
            <input
              id="assignment-start"
              type="date"
              value={dateRange.start}
              onChange={(event) =>
                setDateRange((current) => ({
                  start: event.target.value,
                  end: current.end < event.target.value ? event.target.value : current.end,
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="assignment-end">To date</label>
            <input
              id="assignment-end"
              type="date"
              value={dateRange.end}
              onChange={(event) =>
                setDateRange((current) => ({ ...current, end: event.target.value }))
              }
            />
          </div>
          <button className="button secondary" type="button" onClick={() => applyMonth(currentMonth)}>
            <Filter size={17} />
            Current month
          </button>
        </div>
      </section>

      {error && (
        <section className="panel">
          <p className="muted">{error}</p>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel calendar-panel">
          <div className="panel-header">
            <div className="panel-title">
              <CalendarDays size={20} />
              <div>
                <h2>Calendar</h2>
                <p className="panel-subtitle">
                  {monthStart.toLocaleDateString(undefined, {
                    month: "long",
                    timeZone: BUSINESS_TIME_ZONE,
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="review-actions">
              <button className="icon-button" type="button" onClick={() => applyMonth(addMonths(month, -1))}>
                <ChevronLeft size={17} />
              </button>
              <button className="icon-button" type="button" onClick={() => applyMonth(addMonths(month, 1))}>
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-month">
            {calendarCells.map((key, index) => {
              if (!key) return <div className="calendar-day empty" key={index} />;
              const daySchedules = filteredSchedules.filter((schedule) => toDateKey(schedule.workDate) === key);

              return (
                <button
                  className={`calendar-day ${daySchedules.length ? "scheduled" : ""}`}
                  key={key}
                  type="button"
                  onClick={() => setDateRange({ start: key, end: key })}
                >
                  <strong>{Number(key.slice(-2))}</strong>
                  <span>{daySchedules.length ? `${daySchedules.length} assigned` : ""}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <CalendarDays size={20} />
              <div>
                <h2>Assignments</h2>
                <p className="panel-subtitle">All work dates in the selected period</p>
              </div>
            </div>
          </div>

          <div className="record-list">
            {loading ? (
              <p className="muted">Loading assignments...</p>
            ) : filteredSchedules.length ? (
              filteredSchedules.map((schedule) => {
                const member = users.find((item) => item._id === schedule.userId);
                const template =
                  typeof schedule.shiftTemplateId === "string" ? null : schedule.shiftTemplateId;

                return (
                  <article className="record" key={schedule._id}>
                    <div className="record-row">
                      <span className="record-title">{template?.name || "Assigned shift"}</span>
                      <span className="pill">{formatDate(schedule.workDate)}</span>
                    </div>
                    <span className="muted">
                      {member ? `${member.name} (${member.email})` : `User ID: ${schedule.userId}`}
                    </span>
                    <span className="muted">
                      {template
                        ? `${template.startTime} to ${template.endTime}`
                        : "Template unavailable or archived"}
                    </span>
                  </article>
                );
              })
            ) : (
              <p className="muted">No assignments match this period.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
