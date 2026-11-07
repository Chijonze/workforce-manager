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
  scheduleType?: ScheduleType;
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

export type ScreenMonitorActivityState =
  | "available"
  | "break"
  | "lunch"
  | "meeting"
  | "training"
  | "after_call_work"
  | "ended_shift"
  | "not_clocked_in";

export type ScreenMonitorActivity = {
  state: ScreenMonitorActivityState;
  label: string;
  since?: string;
};

export type ScreenMonitorEmployee = {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  activeMonitorId?: string;
  activity?: ScreenMonitorActivity | null;
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
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  source?: "browser" | "desktop";
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

export type AnalysisChartPoint = {
  label: string;
  value: number;
};

export type AnalysisSection = {
  attendance: string;
  time: string;
  productivity: string;
  screen: string;
  risk: string;
  coaching: string;
  outlook: string;
};

export type AnalysisTimelineEntry = {
  time: string;
  title: string;
  detail: string;
};

export type AnalysisRecommendation = {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type AnalysisDerived = {
  timeUtilisationPercent: number;
  breakSharePercent: number;
  overtimeSharePercent: number;
  idleMinutes: number;
  trackedMinutes: number;
  activeMinutes: number;
  activeToWorkedPercent: number;
  movementsPerActiveHour: number;
  clicksPerActiveHour: number;
  scrollsPerActiveHour: number;
  peakHour: string;
  quietestHour: string;
  activeHourCount: number;
  observedSpanHours: number;
  longestGapMinutes: number;
  longestGapWindow: string;
  screenBlocks: number;
  focusedBlocks: number;
  mixedBlocks: number;
  idleBlocks: number;
  averageScreenConfidence: number;
  topApps: string[];
  topTasks: string[];
};

export type AnalysisScreenBlock = {
  index: number;
  startedAt: string;
  endedAt: string;
  summary: string;
  tasks: string[];
  apps: string[];
  activity: string;
  evidence: string;
  confidence: number;
  source: string;
  captureId?: string | null;
  capturedAt?: string | null;
};

export type ShiftAnalysis = {
  _id: string;
  shiftSessionId: string;
  userId: string;
  workDate: string;
  status: "completed" | "failed";
  source: "ai" | "fallback";
  overallScore: number;
  adherenceScore: number;
  metrics: {
    scheduleType: ScheduleType;
    attendanceStatus: string;
    closureReason: string;
    scheduledMinutes: number;
    workedMinutes: number;
    breakMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
    punctualityScore: number;
    workScore: number;
    activityAdherenceScore: number;
    monitoring: {
      captureCount: number;
      mouseMovements: number;
      mouseDistancePx: number;
      mouseClicks: number;
      mouseScrolls: number;
      mouseSampleCount: number;
      activeSamplePercent: number;
      hourlyActivity: { hour: string; activeMinutes: number }[];
    };
    captures: { captureId: string; capturedAt: string }[];
    eventCounts: Record<string, number>;
  };
  derived?: AnalysisDerived | null;
  narrative: {
    headline: string;
    workerSummary: string;
    workSummary: string;
    highlights: string[];
    concerns: string[];
    /** Present on reports written by the long-form engine. */
    executiveSummary?: string;
    verdict?: string;
    sections?: Partial<AnalysisSection>;
  };
  timeline?: AnalysisTimelineEntry[];
  recommendations?: AnalysisRecommendation[];
  charts: {
    bar: { title: string; unit: string; series: AnalysisChartPoint[] };
    pie: { title: string; unit: string; segments: AnalysisChartPoint[] };
  };
  screenActivity?: {
    status: string;
    overview: string;
    blocks: AnalysisScreenBlock[];
    coverage: Record<string, number>;
  } | null;
  generatedAt: string;
  error?: string | null;
};

export type AnalysisWorker = {
  _id: string;
  name: string;
  email: string;
  role: Role;
};

export type AnalysisWorkerShift = {
  shiftId: string;
  workDate: string;
  clockInTime: string;
  clockOutTime?: string | null;
  attendanceStatus?: string;
  closureReason?: string;
  kpiScore: number;
  analysis: {
    status: string;
    source: string;
    generatedAt: string;
  } | null;
};

export type AnalysisOverview = {
  totalAnalyses: number;
  averageScore: number;
  aiAnalyses: number;
  recentAnalyses: number;
};

export type AggregateWorkerRow = {
  userId: string;
  name: string;
  email: string;
  shiftCount: number;
  absentCount: number;
  averageScore: number;
  averageAdherence: number;
  workedMinutes: number;
  scheduledMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  lateShifts: number;
  lateMinutes: number;
  averagePunctuality: number;
  averageWorkedMinutes: number;
  screenShifts: number;
  screenBlocks: number;
  focusedBlocks: number;
  idleBlocks: number;
  bestDate: string;
  bestScore: number;
  worstDate: string;
  worstScore: number;
  firstDate: string;
  lastDate: string;
  scoreSpread: number;
};

export type AggregateTotals = {
  workers: number;
  analyses: number;
  averageScore: number;
  averageAdherence: number;
  workedMinutes: number;
  scheduledMinutes: number;
  absentCount: number;
  lateShifts: number;
  lateMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
};

export type AggregatePeriodSummary = {
  dayCount: number;
  recordedDays: number;
  attendance: { onTime: number; late: number; veryLate: number; absent: number; overtime: number };
  closures: { label: string; count: number }[];
  hourlyActivity: { hour: string; activeMinutes: number }[];
  weeklyTrend: { label: string; shifts: number; averageScore: number; workedMinutes: number }[];
  topApps: { name: string; count: number }[];
  topTasks: { name: string; count: number }[];
  screen: {
    screenshots: number;
    narratedShifts: number;
    blocks: number;
    focused: number;
    mixed: number;
    idle: number;
  };
  utilisationPercent: number;
  presencePercent: number;
};

export type AggregateStoryBeat = {
  at: string;
  label: string;
  worker: string;
  date: string;
  summary: string;
  apps: string[];
  tasks: string[];
  activity: string;
  confidence: number;
  captureId: string | null;
  capturedAt: string | null;
  shiftId: string;
};

export type AggregateCapture = {
  captureId: string;
  capturedAt: string;
  worker: string;
  date: string;
  note: string;
  shiftId: string;
};

export type AggregateShiftSummary = {
  shiftId: string;
  date: string;
  worker: string;
  userId: string;
  score: number;
  adherence: number;
  attendance: string;
  closure: string;
  workedMinutes: number;
  scheduledMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  activePercent: number;
  screenshots: number;
  screenBlocks: number;
  headline: string;
};

export type PeriodWorkerNote = {
  name: string;
  summary: string;
  strengths: string[];
  watchouts: string[];
  recommendation: string;
};

export type PeriodSections = {
  performance: string;
  attendance: string;
  screenStory: string;
  patterns: string;
  risks: string;
  recommendations: string;
  outlook: string;
};

export type PeriodNarrative = {
  _id: string;
  rangeStart: string;
  rangeEnd: string;
  scopeKey: string;
  totals: AggregateTotals;
  narrative: {
    headline: string;
    summary: string;
    highlights: string[];
    concerns: string[];
    executiveSummary?: string;
    verdict?: string;
    sections?: Partial<PeriodSections>;
    workerNotes?: PeriodWorkerNote[];
  };
  status: "completed" | "failed";
  source: "ai" | "fallback";
  generatedAt: string;
  error?: string | null;
};

export type AggregateAnalysis = {
  startDate: string;
  endDate: string;
  targetUserId: string | null;
  totals: AggregateTotals;
  rows: AggregateWorkerRow[];
  period: AggregatePeriodSummary;
  story: AggregateStoryBeat[];
  captures: AggregateCapture[];
  shifts: AggregateShiftSummary[];
  narrative: PeriodNarrative | null;
};

