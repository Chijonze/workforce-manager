import type { IActivityNarration } from "../../models/ActivityNarration";
import type {
  IAnalysisDerived,
  IAnalysisMetrics,
  IAnalysisSection,
  IAnalysisRecommendation,
  IAnalysisTimelineEntry,
} from "../../models/ShiftAnalysis";
import type { IPeriodSections, IPeriodWorkerNote } from "../../models/PeriodAnalysis";

export type ShiftScreenBlock = {
  index: number;
  window: string;
  startedAt: string;
  endedAt: string;
  summary: string;
  apps: string[];
  tasks: string[];
  activity: string;
  evidence: string;
  concerns: string[];
  confidence: number;
  source: string;
  /** Capture nearest to the block window, used as the report's visual evidence. */
  captureId: string | null;
  capturedAt: string | null;
};

export type ShiftAnalysisContext = {
  shift: any;
  worker: { _id: string; name: string; email: string } | null;
  templateName: string;
  metrics: IAnalysisMetrics;
  derived: IAnalysisDerived;
  narration: IActivityNarration | null;
  screen: {
    status: string;
    overview: string;
    coverage: {
      screenshots: number;
      uniqueFrames: number;
      blocks: number;
      visionCalls: number;
    };
    blocks: ShiftScreenBlock[];
  };
};

export type ShiftNarrative = {
  headline: string;
  workerSummary: string;
  workSummary: string;
  highlights: string[];
  concerns: string[];
  executiveSummary: string;
  verdict: string;
  sections: IAnalysisSection;
};

export type ShiftReportPayload = {
  narrative: ShiftNarrative;
  timeline: IAnalysisTimelineEntry[];
  recommendations: IAnalysisRecommendation[];
};

// ---------------------------------------------------------------------------
// Period report
// ---------------------------------------------------------------------------
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

export type AggregateWeek = {
  label: string;
  shifts: number;
  averageScore: number;
  workedMinutes: number;
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

export type AggregatePeriodSummary = {
  dayCount: number;
  recordedDays: number;
  attendance: { onTime: number; late: number; veryLate: number; absent: number; overtime: number };
  closures: { label: string; count: number }[];
  hourlyActivity: { hour: string; activeMinutes: number }[];
  weeklyTrend: AggregateWeek[];
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

export type PeriodNarrative = {
  headline: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  executiveSummary: string;
  verdict: string;
  sections: IPeriodSections;
  workerNotes: IPeriodWorkerNote[];
};

export type AggregateContext = {
  range: { startDate: string; endDate: string };
  totals: AggregateTotals;
  rows: AggregateWorkerRow[];
  period: AggregatePeriodSummary;
  story: AggregateStoryBeat[];
  captures: AggregateCapture[];
  shifts: AggregateShiftSummary[];
  workerScreenNotes: Record<string, string[]>;
};
