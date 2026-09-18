export type Role = "admin" | "supervisor" | "agent";

export type User = {
  _id: string;
  name: string;
  email: string;
  organizationName?: string;
  organizationAddress?: string;
  companyNumber?: string;
  monitorId?: string;
  role: Role;
  accountStatus?: "pending" | "approved";
  mfaEnabled?: boolean;
  assignedAgentIds?: string[];
};

export type ScheduleType = "time_managed" | "fluid";

export type ShiftTemplate = {
  _id: string;
  name: string;
  scheduleType?: ScheduleType;
  startTime: string;
  endTime: string;
  breaks: {
    label: string;
    type?: "break" | "lunch";
    mode?: "static" | "dynamic";
    startTime?: string;
    endTime?: string;
    durationMinutes: number;
    startAt?: string;
    endAt?: string;
  }[];
  activities?: {
    label: string;
    type: "meeting" | "training" | "after_call_work";
    startTime?: string;
    endTime?: string;
    durationMinutes: number;
    startAt?: string;
    endAt?: string;
  }[];
  isActive: boolean;
};

export type Schedule = {
  _id: string;
  userId: string;
  shiftTemplateId: ShiftTemplate | string;
  workDate: string;
  scheduleType?: ScheduleType;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  scheduledMinutes?: number;
};

export type ShiftSession = {
  _id: string;
  userId: string;
  scheduleId?: string;
  shiftTemplateId?: string;
  scheduleType?: ScheduleType;
  clockInTime: string;
  clockOutTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  status: "active" | "completed" | "paused" | "expired";
  attendanceStatus?: "on_time" | "late" | "very_late" | "absent" | "overtime";
  lateMinutes?: number;
  overtimeMinutes?: number;
  scheduledMinutes?: number;
  kpiScore?: number;
  adherenceScore?: number;
  workScore?: number;
  punctualityScore?: number;
  activityAdherenceScore?: number;
  kpiEvaluatedAt?: string;
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
};

export type ShiftEvent = {
  _id: string;
  shiftId: string;
  userId: string;
  type:
    | "SHIFT_START"
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
    | "SHIFT_END";
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
  kpiScore?: number;
  adherenceScore?: number;
  workedMinutes: number;
  invoiceWorkedMinutes?: number;
  scheduledMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  breakdown: {
    workScore: number;
    punctualityScore: number;
    breakScore: number;
    activityAdherenceScore?: number;
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
    averageAdherence: number;
  };
  users: {
    user: User;
    performance: DailyPerformance;
  }[];
  schedules: Schedule[];
};

export type ExecutionReport = {
  startDate: string;
  endDate: string;
  totals: {
    records: number;
    users: number;
    scheduledMinutes: number;
    workedMinutes: number;
    breakMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
    averageAdherence: number;
    averagePerformance: number;
  };
  rows: { date: string; user: User; performance: DailyPerformance }[];
};

export type LeaveRequest = {
  _id: string;
  userId: string;
  leaveType: "annual" | "sick" | "personal" | "unpaid" | "other";
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  managerComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
};

export type ChatConversation = {
  _id: string;
  participants: User[];
  otherParticipant: User;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ChatMessage = {
  _id: string;
  conversationId: string;
  senderId: User;
  body: string;
  readBy: string[];
  createdAt: string;
  updatedAt?: string;
};

export type ScreenMonitorPresence = {
  type: "presence";
  employees: string[];
  assignedEmployees?: ScreenMonitorEmployee[];
};

export type ScreenMonitorEmployee = {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  activeMonitorId?: string;
};


export type MouseSample = {
  at: string;
  movements: number;
  distancePx: number;
  clicks: number;
  scrolls: number;
};

export type MouseTotals = {
  movements: number;
  distancePx: number;
  clicks: number;
  scrolls: number;
  sampleCount: number;
};

export type MonitoringCapture = {
  _id: string;
  seq: number;
  capturedAt: string;
  sizeBytes: number;
  width: number;
  height: number;
};

export type MonitoringDetail = {
  monitoring: {
    _id: string;
    userId: string;
    shiftSessionId: string;
    scheduleType: ScheduleType;
    status: "active" | "completed" | "expired";
    startedAt: string;
    endedAt?: string | null;
    capturePlan: number;
    captures: MonitoringCapture[];
    mouseTotals: MouseTotals;
    mouseSamples: MouseSample[];
  };
  shift: {
    _id: string;
    userId: string;
    clockInTime: string;
    clockOutTime?: string | null;
    scheduledStartTime?: string | null;
    scheduledEndTime?: string | null;
    status: string;
    scheduleType?: ScheduleType;
    totalWorkedMinutes: number;
    totalBreakMinutes: number;
    attendanceStatus?: string;
  } | null;
};

export type MonitoringSummary = {
  _id: string;
  userId: string;
  shiftSessionId: string;
  scheduleType: ScheduleType;
  status: "active" | "completed" | "expired";
  startedAt: string;
  endedAt?: string | null;
  capturePlan: number;
  captureCount: number;
  mouseTotals: MouseTotals;
  captures: { seq: number; capturedAt: string }[];
  shift?: {
    clockInTime: string;
    clockOutTime?: string | null;
    status: string;
    attendanceStatus?: string;
    scheduleType?: ScheduleType;
    totalWorkedMinutes: number;
    totalBreakMinutes: number;
  } | null;
};

export type MonitoringSessionStart = {
  monitoringSessionId: string;
  capturePlan: number;
  captures: number;
  startedAt: string;
};
