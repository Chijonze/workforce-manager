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
  source: "gemini" | "fallback";
  aiModel: string;

  overallScore: number;
  adherenceScore: number;

  metrics: IAnalysisMetrics;

  narrative: {
    headline: string;
    workerSummary: string;
    workSummary: string;
    highlights: string[];
    concerns: string[];
  };

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
      enum: ["gemini", "fallback"],
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

    narrative: {
      type: {
        headline: { type: String, default: "" },
        workerSummary: { type: String, default: "" },
        workSummary: { type: String, default: "" },
        highlights: { type: [String], default: [] },
        concerns: { type: [String], default: [] },
      },
      required: true,
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
