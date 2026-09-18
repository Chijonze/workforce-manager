"use client";

import type { CSSProperties } from "react";
import type {
  LeaveRequest,
  Schedule,
  ShiftEvent,
  ShiftTemplate,
} from "@/types/workforce";

export const BUSINESS_TIME_ZONE = "Europe/London";

export type Toast = { id: number; type: "success" | "error"; message: string };

export function formatRole(role: string) {
  return role === "supervisor" ? "Hiring manager" : role;
}

export function escapeExcelCell(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function londonDateParts(value: Date | string = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function toDateKey(value: Date | string) {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return dateOnly[0];
  }

  const date = value instanceof Date ? value : new Date(value);
  const parts = londonDateParts(date);
  return dateKeyFromParts(parts.year, parts.month, parts.day);
}

// Minutes between two "HH:MM" clock times with an overnight wrap: 23:45 -> 00:15
// is 30 minutes, not 0. Short windows (30 minutes and below) must survive
// exactly as configured.
export function minutesBetweenTimes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 0;

  const startMatch = startTime.match(/^(\d{1,2}):(\d{2})/);
  const endMatch = endTime.match(/^(\d{1,2}):(\d{2})/);
  if (!startMatch || !endMatch) return 0;

  const startTotal = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  const endTotal = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  const duration = (endTotal - startTotal + 1440) % 1440;

  return duration;
}

export function formatTimeRange(startTime?: string, endTime?: string) {
  const normalizeTime = (time?: string) => {
    const match = time?.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return null;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const normalizedStart = normalizeTime(startTime);
  const normalizedEnd = normalizeTime(endTime);

  if (!normalizedStart || !normalizedEnd) return "Time not set";

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
  const baseDate = "2026-01-01";
  const startDate = new Date(`${baseDate}T${normalizedStart}:00Z`);
  const endDate = new Date(`${baseDate}T${normalizedEnd}:00Z`);

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

export function minutesBetween(start?: string, end?: string) {
  if (!start) return 0;
  const endTime = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((endTime - new Date(start).getTime()) / 60000));
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getScheduleTemplateId(schedule: Schedule) {
  return typeof schedule.shiftTemplateId === "string"
    ? schedule.shiftTemplateId
    : schedule.shiftTemplateId?._id;
}

export function getScheduleTemplate(schedule: Schedule): ShiftTemplate | null {
  return typeof schedule.shiftTemplateId === "string" ? null : schedule.shiftTemplateId || null;
}

export function isDateInLeave(date: Date, leave: LeaveRequest) {
  const key = toDateKey(date);
  return key >= toDateKey(leave.startDate) && key <= toDateKey(leave.endDate);
}

export const eventLabels: Record<ShiftEvent["type"], string> = {
  SHIFT_START: "Shift started",
  WORK_START: "Available",
  BREAK_START: "Break started",
  BREAK_END: "Break ended",
  LUNCH_START: "Lunch started",
  LUNCH_END: "Lunch ended",
  MEETING_START: "Meeting started",
  MEETING_END: "Meeting ended",
  TRAINING_START: "Training started",
  TRAINING_END: "Training ended",
  AFTER_CALL_WORK_START: "After call work started",
  AFTER_CALL_WORK_END: "After call work ended",
  SHIFT_END: "Shift ended",
};

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const score = Math.max(0, Math.min(100, value));

  return (
    <div className="score-bar">
      <div className="record-row">
        <span>{label}</span>
        <strong>{score}%</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function DesktopOnlyNotice() {
  return (
    <main className="desktop-only-notice">
      <section className="auth-panel">
        <div className="brand">
          <div className="brand-mark brand-mark-img">
            <img alt="" src="/shiftsync-icon.png" />
          </div>
          <div>
            <h1>ShiftSync</h1>
            <p>Desktop access required</p>
          </div>
        </div>
        <p className="muted">
          This workforce management system is restricted to laptop and desktop screens. Please open
          it on a computer to continue.
        </p>
      </section>
    </main>
  );
}

export const scorePieStyle = (score: number) =>
  ({ "--score": `${Math.max(0, Math.min(100, score))}%` } as CSSProperties);
