import mongoose, { Schema, Document } from "mongoose";

export interface IAnalysisCaptureRef {
  captureId: mongoose.Types.ObjectId;
  capturedAt: Date;
}

export interface IAnalysisChartPoint {
  label: string;
  value: number;
}

export interface IAnalysisMetrics {
  scheduleType: "time_managed" | "fluid";
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
  captures: IAnalysisCaptureRef[];
  eventCounts: Record<string, number>;
}

/**
 * Deterministic analytics computed in code from the raw telemetry. The model is
 * asked to narrate these numbers rather than derive them, which keeps the long
 * report factual and prevents arithmetic drift between paragraphs.
 */
export interface IAnalysisDerived {
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
}

export interface IAnalysisSection {
  attendance: string;
  time: string;
  productivity: string;
  screen: string;
  risk: string;
  coaching: string;
  outlook: string;
}

export interface IAnalysisTimelineEntry {
  time: string;
  title: string;
  detail: string;
}

export interface IAnalysisRecommendation {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export interface IAnalysisScreenBlock {
  index: number;
  startedAt: Date;
  endedAt: Date;
  summary: string;
  tasks: string[];
  apps: string[];
  activity: string;
  evidence: string;
  confidence: number;
  source: string;
  /** Capture nearest to this window, so the PDF can pair image and narration. */
  captureId?: mongoose.Types.ObjectId | null;
  capturedAt?: Date | null;
}

export interface IAnalysisScreenActivity {
  status: string;
  overview: string;
  blocks: IAnalysisScreenBlock[];
  coverage: Record<string, number>;
}

export interface IShiftAnalysis extends Document {
  shiftSessionId: mongoose.Types.ObjectId;
  userId: string;
  workDate: string;

  status: "completed" | "failed";
  source: "ai" | "fallback";
  /**
   * Internal operations data only. Never serialised to the client: users must
   * not be able to tell which model wrote a report.
   */
  aiModel: string;

  overallScore: number;
  adherenceScore: number;

  metrics: IAnalysisMetrics;
  derived?: IAnalysisDerived | null;

  narrative: {
    headline: string;
    /** Legacy short fields, kept so saved reports stay readable after upgrades. */
    workerSummary: string;
    workSummary: string;
    highlights: string[];
    concerns: string[];
    executiveSummary: string;
    verdict: string;
    sections: IAnalysisSection;
  };

  timeline: IAnalysisTimelineEntry[];
  recommendations: IAnalysisRecommendation[];

  charts: {
    bar: { title: string; unit: string; series: IAnalysisChartPoint[] };
    pie: { title: string; unit: string; segments: IAnalysisChartPoint[] };
  };

  /** Per-block narration of what was visible in the shift's screenshots. */
  screenActivity?: IAnalysisScreenActivity | null;

  generatedAt: Date;
  error?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const chartPointSchema = new Schema<IAnalysisChartPoint>(
  {
    label: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const analysisMetricsSchema = new Schema<IAnalysisMetrics>(
  {
    scheduleType: {
      type: String,
      enum: ["time_managed", "fluid"],
      default: "time_managed",
    },
    attendanceStatus: { type: String, default: "on_time" },
    closureReason: { type: String, default: "manual" },
    scheduledMinutes: { type: Number, default: 0 },
    workedMinutes: { type: Number, default: 0 },
    breakMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    punctualityScore: { type: Number, default: 0 },
    workScore: { type: Number, default: 0 },
    activityAdherenceScore: { type: Number, default: 0 },
    monitoring: {
      type: {
        captureCount: { type: Number, default: 0 },
        mouseMovements: { type: Number, default: 0 },
        mouseDistancePx: { type: Number, default: 0 },
        mouseClicks: { type: Number, default: 0 },
        mouseScrolls: { type: Number, default: 0 },
        mouseSampleCount: { type: Number, default: 0 },
        activeSamplePercent: { type: Number, default: 0 },
        hourlyActivity: {
          type: [{ hour: String, activeMinutes: Number }],
          default: [],
        },
      },
      default: {},
    },
    captures: {
      type: [
        {
          captureId: { type: Schema.Types.ObjectId, required: true },
          capturedAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    eventCounts: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const analysisDerivedSchema = new Schema<IAnalysisDerived>(
  {
    timeUtilisationPercent: { type: Number, default: 0 },
    breakSharePercent: { type: Number, default: 0 },
    overtimeSharePercent: { type: Number, default: 0 },
    idleMinutes: { type: Number, default: 0 },
    trackedMinutes: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    activeToWorkedPercent: { type: Number, default: 0 },
    movementsPerActiveHour: { type: Number, default: 0 },
    clicksPerActiveHour: { type: Number, default: 0 },
    scrollsPerActiveHour: { type: Number, default: 0 },
    peakHour: { type: String, default: "" },
    quietestHour: { type: String, default: "" },
    activeHourCount: { type: Number, default: 0 },
    observedSpanHours: { type: Number, default: 0 },
    longestGapMinutes: { type: Number, default: 0 },
    longestGapWindow: { type: String, default: "" },
    screenBlocks: { type: Number, default: 0 },
    focusedBlocks: { type: Number, default: 0 },
    mixedBlocks: { type: Number, default: 0 },
    idleBlocks: { type: Number, default: 0 },
    averageScreenConfidence: { type: Number, default: 0 },
    topApps: { type: [String], default: [] },
    topTasks: { type: [String], default: [] },
  },
  { _id: false }
);

const sectionsSchema = new Schema<IAnalysisSection>(
  {
    attendance: { type: String, default: "" },
    time: { type: String, default: "" },
    productivity: { type: String, default: "" },
    screen: { type: String, default: "" },
    risk: { type: String, default: "" },
    coaching: { type: String, default: "" },
    outlook: { type: String, default: "" },
  },
  { _id: false }
);

const timelineEntrySchema = new Schema<IAnalysisTimelineEntry>(
  {
    time: { type: String, default: "" },
    title: { type: String, default: "" },
    detail: { type: String, default: "" },
  },
  { _id: false }
);

const recommendationSchema = new Schema<IAnalysisRecommendation>(
  {
    title: { type: String, default: "" },
    detail: { type: String, default: "" },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
  },
  { _id: false }
);

const screenBlockSchema = new Schema<IAnalysisScreenBlock>(
  {
    index: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    summary: { type: String, default: "" },
    tasks: { type: [String], default: [] },
    apps: { type: [String], default: [] },
    activity: { type: String, default: "unknown" },
    evidence: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
    source: { type: String, default: "" },
    captureId: { type: Schema.Types.ObjectId, default: null },
    capturedAt: { type: Date, default: null },
  },
  { _id: false }
);

const screenActivitySchema = new Schema<IAnalysisScreenActivity>(
  {
    status: { type: String, default: "completed" },
    overview: { type: String, default: "" },
    blocks: { type: [screenBlockSchema], default: [] },
    coverage: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const shiftAnalysisSchema = new Schema<IShiftAnalysis>(
  {
    shiftSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftSession",
      required: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    workDate: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },

    source: {
      type: String,
      enum: ["ai", "fallback"],
      default: "fallback",
    },

    aiModel: {
      type: String,
      default: "",
    },

    overallScore: {
      type: Number,
      default: 0,
    },

    adherenceScore: {
      type: Number,
      default: 0,
    },

    metrics: {
      type: analysisMetricsSchema,
      required: true,
    },

    derived: {
      type: analysisDerivedSchema,
      default: null,
    },

    narrative: {
      type: {
        headline: { type: String, default: "" },
        workerSummary: { type: String, default: "" },
        workSummary: { type: String, default: "" },
        highlights: { type: [String], default: [] },
        concerns: { type: [String], default: [] },
        executiveSummary: { type: String, default: "" },
        verdict: { type: String, default: "" },
        sections: {
          type: sectionsSchema,
          default: () => ({}),
        },
      },
      required: true,
    },

    timeline: {
      type: [timelineEntrySchema],
      default: [],
    },

    recommendations: {
      type: [recommendationSchema],
      default: [],
    },

    charts: {
      type: {
        bar: {
          type: {
            title: { type: String, default: "" },
            unit: { type: String, default: "" },
            series: { type: [chartPointSchema], default: [] },
          },
          required: true,
        },
        pie: {
          type: {
            title: { type: String, default: "" },
            unit: { type: String, default: "" },
            segments: { type: [chartPointSchema], default: [] },
          },
          required: true,
        },
      },
      required: true,
    },

    screenActivity: {
      type: screenActivitySchema,
      default: null,
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

shiftAnalysisSchema.index({ userId: 1, workDate: -1 });
shiftAnalysisSchema.index({ shiftSessionId: 1 }, { unique: true });

export default mongoose.models.ShiftAnalysis ||
  mongoose.model<IShiftAnalysis>("ShiftAnalysis", shiftAnalysisSchema);
