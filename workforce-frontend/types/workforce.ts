export type Role = "admin" | "supervisor" | "agent";

export type User = {
  _id: string;
  name: string;
  email: string;
  role: Role;
  mfaEnabled?: boolean;
};

export type ShiftTemplate = {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  breaks: {
    label: string;
    type?: "break" | "lunch";
    startTime?: string;
    endTime?: string;
    durationMinutes: number;
  }[];
  activities?: {
    label: string;
    type: "meeting" | "training" | "after_call_work";
    startTime?: string;
    endTime?: string;
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
};
