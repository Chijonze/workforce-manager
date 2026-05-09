export type AllowedAction =
  | "SHIFT_START"
  | "WORK_START"
  | "BREAK_START"
  | "BREAK_END"
  | "SHIFT_END";

export type ViolationType =
  | "NO_SCHEDULE"
  | "OUTSIDE_SHIFT_WINDOW"
  | "SHIFT_ALREADY_ACTIVE"
  | "INVALID_BREAK_SEQUENCE";

export interface ScheduleWindow {
  startTime: string; // "08:00"
  endTime: string;   // "20:00"
  date: string;       // "2026-05-06"
}

export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  violationType?: ViolationType;
  schedule?: any;
}