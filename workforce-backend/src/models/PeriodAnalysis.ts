import mongoose, { Schema, Document } from "mongoose";

export interface IPeriodWorkerNote {
  name: string;
  summary: string;
  strengths: string[];
  watchouts: string[];
  recommendation: string;
}

export interface IPeriodSections {
  performance: string;
  attendance: string;
  screenStory: string;
  patterns: string;
  risks: string;
  recommendations: string;
  outlook: string;
}

export interface IPeriodAnalysis extends Document {
  rangeStart: string;
  rangeEnd: string;
  // "admin" or the supervisor's user id — narratives are scoped per viewer.
  scopeKey: string;

  totals: {
    workers: number;
    analyses: number;
    averageScore: number;
    averageAdherence: number;
    workedMinutes: number;
    absentCount: number;
  };

  narrative: {
    headline: string;
    /** Legacy short summary, kept for existing saved reports. */
    summary: string;
    highlights: string[];
    concerns: string[];
    executiveSummary: string;
    verdict: string;
    sections: IPeriodSections;
    workerNotes: IPeriodWorkerNote[];
  };

  status: "completed" | "failed";
  source: "ai" | "fallback";
  /** Internal operations data only; never serialised to the client. */
  aiModel: string;

  generatedAt: Date;
  error?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const periodTotalsSchema = new Schema<IPeriodAnalysis["totals"]>(
  {
    workers: { type: Number, default: 0 },
    analyses: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    averageAdherence: { type: Number, default: 0 },
    workedMinutes: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const periodSectionsSchema = new Schema<IPeriodSections>(
  {
    performance: { type: String, default: "" },
    attendance: { type: String, default: "" },
    screenStory: { type: String, default: "" },
    patterns: { type: String, default: "" },
    risks: { type: String, default: "" },
    recommendations: { type: String, default: "" },
    outlook: { type: String, default: "" },
  },
  { _id: false }
);

const workerNoteSchema = new Schema<IPeriodWorkerNote>(
  {
    name: { type: String, default: "" },
    summary: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    watchouts: { type: [String], default: [] },
    recommendation: { type: String, default: "" },
  },
  { _id: false }
);

const periodAnalysisSchema = new Schema<IPeriodAnalysis>(
  {
    rangeStart: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    rangeEnd: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    scopeKey: {
      type: String,
      required: true,
    },
    totals: {
      type: periodTotalsSchema,
      required: true,
    },
    narrative: {
      type: {
        headline: { type: String, default: "" },
        summary: { type: String, default: "" },
        highlights: { type: [String], default: [] },
        concerns: { type: [String], default: [] },
        executiveSummary: { type: String, default: "" },
        verdict: { type: String, default: "" },
        sections: { type: periodSectionsSchema, default: () => ({}) },
        workerNotes: { type: [workerNoteSchema], default: [] },
      },
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

periodAnalysisSchema.index(
  { rangeStart: 1, rangeEnd: 1, scopeKey: 1 },
  { unique: true }
);

export default mongoose.models.PeriodAnalysis ||
  mongoose.model<IPeriodAnalysis>("PeriodAnalysis", periodAnalysisSchema);
