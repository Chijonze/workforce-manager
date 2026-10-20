import mongoose, { Schema, Document } from "mongoose";

export interface IMouseSample {
  at: Date;
  movements: number;
  distancePx: number;
  clicks: number;
  scrolls: number;
}

export interface IMonitoringCapture {
  seq: number;
  capturedAt: Date;
  filePath: string;
  sizeBytes: number;
  width: number;
  height: number;
  // Screenshots are stored as WebP when the server can re-encode them; older
  // captures have no mimeType and are served as JPEG.
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  source?: "browser" | "desktop";
}

export interface IMonitoringSession extends Document {
  userId: string;
  shiftSessionId: mongoose.Types.ObjectId;
  scheduleType: "time_managed" | "fluid";
  status: "active" | "completed" | "expired";
  startedAt: Date;
  endedAt?: Date;
  capturePlan: number;
  captures: IMonitoringCapture[];
  mouseSamples: IMouseSample[];
  desktopAgentActive?: boolean;
  desktopAgentAt?: Date;
  mouseTotals: {
    movements: number;
    distancePx: number;
    clicks: number;
    scrolls: number;
    sampleCount: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Screenshots follow a fixed cadence (one every CAPTURE_INTERVAL_MINUTES from
// shift start to end shift) rather than a fixed count. MAX_CAPTURES is only an
// abuse bound: 96 covers 24h of continuous work at the 15-minute cadence and
// keeps the document (plus 24h of one-minute mouse samples) small enough to
// stay cheap to update incrementally.
export const MAX_CAPTURES = 96;
export const CAPTURE_INTERVAL_MINUTES = 15;
export const MAX_MOUSE_SAMPLES = 1500;

const mouseSampleSchema = new Schema<IMouseSample>(
  {
    at: { type: Date, required: true },
    movements: { type: Number, default: 0 },
    distancePx: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    scrolls: { type: Number, default: 0 },
  },
  { _id: false }
);

const captureSchema = new Schema<IMonitoringCapture>(
  {
    seq: { type: Number, required: true },
    capturedAt: { type: Date, required: true },
    filePath: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    mimeType: {
      type: String,
      enum: ["image/jpeg", "image/png", "image/webp"],
      default: "image/jpeg",
    },
    source: { type: String, enum: ["browser", "desktop"], default: "browser" },
  },
  { _id: true }
);

const monitoringSessionSchema = new Schema<IMonitoringSession>(
  {
    userId: { type: String, required: true, index: true },
    shiftSessionId: { type: Schema.Types.ObjectId, ref: "ShiftSession", required: true },
    scheduleType: {
      type: String,
      enum: ["time_managed", "fluid"],
      default: "time_managed",
    },
    status: {
      type: String,
      enum: ["active", "completed", "expired"],
      default: "active",
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    // Informational: expected screenshots for the scheduled window at the
    // fixed cadence. It no longer gates uploads (MAX_CAPTURES does).
    capturePlan: { type: Number, default: 0 },
    captures: { type: [captureSchema], default: [] },
    mouseSamples: { type: [mouseSampleSchema], default: [] },
    mouseTotals: {
      type: {
        movements: { type: Number, default: 0 },
        distancePx: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        scrolls: { type: Number, default: 0 },
        sampleCount: { type: Number, default: 0 },
      },
      default: {},
    },
  },
  { timestamps: true }
);

monitoringSessionSchema.index({ shiftSessionId: 1 }, { unique: true });
monitoringSessionSchema.index({ userId: 1, startedAt: -1 });

export default mongoose.models.MonitoringSession ||
  mongoose.model<IMonitoringSession>("MonitoringSession", monitoringSessionSchema);
