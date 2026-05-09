export type Role = "admin" | "agent";

export type User = {
  _id: string;
  name: string;
  email: string;
  role: Role;
};

export type ShiftTemplate = {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  breaks: {
    label: string;
    durationMinutes: number;
  }[];
  isActive: boolean;
};

export type Schedule = {
  _id: string;
  userId: string;
  shiftTemplateId: ShiftTemplate | string;
  workDate: string;
};

export type ShiftSession = {
  _id: string;
  userId: string;
  scheduleId?: string;
  shiftTemplateId?: string;
  clockInTime: string;
  clockOutTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status: "active" | "completed" | "paused" | "expired";
  attendanceStatus?: "on_time" | "late" | "very_late" | "absent" | "overtime";
  lateMinutes?: number;
  overtimeMinutes?: number;
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
};

export type ShiftEvent = {
  _id: string;
  shiftId: string;
  userId: string;
  type: "SHIFT_START" | "WORK_START" | "BREAK_START" | "BREAK_END" | "SHIFT_END";
  timestamp: string;
};

export type ActiveShiftResponse = {
  shift: ShiftSession;
  currentState: ShiftEvent["type"] | null;
} | null;

export type DailyPerformance = {
  date: string;
  scheduled: boolean;
  status: string;
  overallScore: number;
  workedMinutes: number;
  scheduledMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  breakdown: {
    workScore: number;
    punctualityScore: number;
    breakScore: number;
  };
};

export type AdminOverview = {
  date: string;
  totals: {
    users: number;
    scheduled: number;
    active: number;
    present: number;
    absent: number;
    late: number;
    overtime: number;
    unscheduledUsers: number;
    attendanceRate: number;
    averagePerformance: number;
  };
  users: {
    user: User;
    performance: DailyPerformance;
  }[];
  schedules: Schedule[];
};
