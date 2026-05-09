export type ComplianceStatus =
  | "COMPLIANT"
  | "LATE"
  | "OVERTIME"
  | "INCOMPLETE"
  | "ABSENT";

export interface BreakSession {
  breakIndex: number;
  label: string;
  allowedDurationMinutes: number;
  actualDurationMinutes?: number;
  startedAt?: Date;
  endedAt?: Date;
}

export interface AttendanceMetrics {
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  complianceStatus: ComplianceStatus;
}

export interface ActiveShiftState {
  currentState:
    | "SHIFT_START"
    | "WORK_START"
    | "BREAK_START"
    | "BREAK_END"
    | "SHIFT_END";

  currentBreakIndex: number;

  isOnBreak: boolean;

  startedAt: Date;
}