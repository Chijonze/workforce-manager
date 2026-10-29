import mongoose, { Document, Schema } from "mongoose";

export type BlockActivity = "focused" | "mixed" | "idle" | "unknown";

export interface INarrationBlock {
  index: number;
  startedAt: Date;
  endedAt: Date;
  /** Capture sequence numbers that were actually sent to the model. */
  frameSeqs: number[];
  /** Raw captures in the window, before duplicate/blank filtering. */
  captureCount: number;
  uniqueFrameCount: number;
  summary: string;
  tasks: string[];
  apps: string[];
  activity: BlockActivity;
  evidence: string;
  concerns: string[];
  confidence: number;
  /** `deterministic` marks idle/blank periods detected without a model call. */
  source: "gemini" | "ocr" | "deterministic";
  model: string;
  ocrChars: number;
  imageBytes: number;
  latencyMs: number;
  error?: string | null;
}

export interface INarrationCoverage {
  captures: number;
  uniqueFrames: number;
  duplicatesSkipped: number;
  blankFrames: number;
  missingFiles: number;
  blocks: number;
  visionCalls: number;
  ocrFrames: number;
  skippedFrames: number;
}

export interface IActivityNarration extends Document {
  shiftSessionId: mongoose.Types.ObjectId;
  userId: string;
  status: "completed" | "partial" | "failed" | "empty";
  blocks: INarrationBlock[];
  overview: string;
  coverage: INarrationCoverage;
  source: "gemini" | "ocr" | "none";
  aiModel: string;
  generatedAt: Date;
  error?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const narrationBlockSchema = new Schema<INarrationBlock>(
  {
    index: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    frameSeqs: { type: [Number], default: [] },
    captureCount: { type: Number, default: 0 },
    uniqueFrameCount: { type: Number, default: 0 },
    summary: { type: String, default: "" },
    tasks: { type: [String], default: [] },
    apps: { type: [String], default: [] },
    activity: {
      type: String,
      enum: ["focused", "mixed", "idle", "unknown"],
      default: "unknown",
    },
    evidence: { type: String, default: "" },
    concerns: { type: [String], default: [] },
    confidence: { type: Number, default: 0 },
    source: { type: String, enum: ["gemini", "ocr", "deterministic"], default: "gemini" },
    model: { type: String, default: "" },
    ocrChars: { type: Number, default: 0 },
    imageBytes: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { _id: false }
);

const coverageSchema = new Schema<INarrationCoverage>(
  {
    captures: { type: Number, default: 0 },
    uniqueFrames: { type: Number, default: 0 },
    duplicatesSkipped: { type: Number, default: 0 },
    blankFrames: { type: Number, default: 0 },
    missingFiles: { type: Number, default: 0 },
    blocks: { type: Number, default: 0 },
    visionCalls: { type: Number, default: 0 },
    ocrFrames: { type: Number, default: 0 },
    skippedFrames: { type: Number, default: 0 },
  },
  { _id: false }
);

const activityNarrationSchema = new Schema<IActivityNarration>(
  {
    shiftSessionId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftSession",
      required: true,
    },
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["completed", "partial", "failed", "empty"],
      default: "completed",
    },
    blocks: { type: [narrationBlockSchema], default: [] },
    overview: { type: String, default: "" },
    coverage: { type: coverageSchema, default: {} },
    source: { type: String, enum: ["gemini", "ocr", "none"], default: "none" },
    aiModel: { type: String, default: "" },
    generatedAt: { type: Date, default: Date.now },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

activityNarrationSchema.index({ shiftSessionId: 1 }, { unique: true });
activityNarrationSchema.index({ userId: 1, generatedAt: -1 });

export default mongoose.models.ActivityNarration ||
  mongoose.model<IActivityNarration>("ActivityNarration", activityNarrationSchema);
