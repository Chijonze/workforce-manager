import path from "path";
import fs from "fs";
import ShiftSession from "../../models/ShiftSession";
import MonitoringSession, {
  CAPTURE_INTERVAL_MINUTES,
  MAX_CAPTURES,
  MAX_MOUSE_SAMPLES,
} from "../../models/MonitoringSession";
import User from "../../models/User";
import { notifyMonitoringAgent } from "./monitoringAgentBus";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SAMPLE_VALUES = {
  movements: 10_000,
  distancePx: 5_000_000,
  clicks: 600,
  scrolls: 600,
};

// Screenshots are re-encoded to WebP so a dense 1280px desktop capture stays
// under the 300KB budget while text remains readable. WebP is roughly 25-35%
// smaller than JPEG at the same visual quality.
export const CAPTURE_TARGET_BYTES = 300 * 1000;
const CAPTURE_MAX_WIDTH = 1600;
const CAPTURE_MAX_PIXELS = 50_000_000;
const WEBP_QUALITY_LADDER = [86, 78, 70, 62];
const DOWNSCALE_STEPS = [1, 0.85, 0.7, 0.55, 0.42];
const CAPTURE_INTERVAL_MS = CAPTURE_INTERVAL_MINUTES * 60_000;

type CaptureFormat = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

type OptimizedCapture = CaptureFormat & {
  buffer: Buffer;
  width: number;
  height: number;
};

type SharpModule = ((input: Buffer, options?: Record<string, unknown>) => any) | null;

// sharp is a native dependency and is optional: when it is not installed the
// original bytes are stored and clients still enforce the budget themselves.
let sharpModule: SharpModule = null;
let sharpResolved = false;

const getSharp = (): SharpModule => {
  if (sharpResolved) return sharpModule;

  sharpResolved = true;
  try {
    sharpModule = require("sharp") as SharpModule;
  } catch {
    sharpModule = null;
    console.warn("sharp is unavailable; monitoring screenshots will be stored as uploaded");
  }

  return sharpModule;
};

const detectCaptureFormat = (buffer: Buffer): CaptureFormat | null => {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  if (buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return { mimeType: "image/png", extension: "png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  return null;
};

const optimizeCapture = async (
  raw: Buffer,
  detected: CaptureFormat
): Promise<OptimizedCapture> => {
  // A browser that already encoded a WebP under budget is left untouched:
  // re-encoding would only add CPU work and could soften text.
  if (detected.mimeType === "image/webp" && raw.length <= CAPTURE_TARGET_BYTES) {
    return { buffer: raw, ...detected, width: 0, height: 0 };
  }

  const sharp = getSharp();

  if (!sharp) {
    return { buffer: raw, ...detected, width: 0, height: 0 };
  }

  try {
    const metadata = await sharp(raw, {
      failOn: "none",
      limitInputPixels: CAPTURE_MAX_PIXELS,
    }).metadata();

    const sourceWidth = Math.max(1, Math.round(Number(metadata.width) || CAPTURE_MAX_WIDTH));
    const cappedWidth = Math.min(sourceWidth, CAPTURE_MAX_WIDTH);
    const widths = DOWNSCALE_STEPS
      .map((scale) => Math.max(1, Math.round(cappedWidth * scale)))
      .filter((width, index, list) => width >= 480 && list.indexOf(width) === index);

    let smallest: OptimizedCapture | null = null;

    for (const width of widths) {
      for (const quality of WEBP_QUALITY_LADDER) {
        const { data, info } = await sharp(raw, {
          failOn: "none",
          limitInputPixels: CAPTURE_MAX_PIXELS,
        })
          .rotate()
          .resize({ width, height: 4000, fit: "inside", withoutEnlargement: true })
          .webp({ quality, effort: 4, smartSubsample: true })
          .toBuffer({ resolveWithObject: true });

        const candidate: OptimizedCapture = {
          buffer: data,
          mimeType: "image/webp",
          extension: "webp",
          width: Number(info.width) || width,
          height: Number(info.height) || 0,
        };

        if (!smallest || candidate.buffer.length < smallest.buffer.length) {
          smallest = candidate;
        }

        if (candidate.buffer.length <= CAPTURE_TARGET_BYTES) {
          return candidate;
        }
      }
    }

    // Pathological aspect ratios (very tall/wide screens) can miss the width
    // ladder above; one last bounded attempt guarantees the budget.
    const fallback = await sharp(raw, {
      failOn: "none",
      limitInputPixels: CAPTURE_MAX_PIXELS,
    })
      .rotate()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 50, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const fallbackCapture: OptimizedCapture = {
      buffer: fallback.data,
      mimeType: "image/webp",
      extension: "webp",
      width: Number(fallback.info.width) || 640,
      height: Number(fallback.info.height) || 0,
    };

    if (
      fallbackCapture.buffer.length <= CAPTURE_TARGET_BYTES ||
      !smallest ||
      fallbackCapture.buffer.length < smallest.buffer.length
    ) {
      return fallbackCapture;
    }

    return smallest || { buffer: raw, ...detected, width: 0, height: 0 };
  } catch (error) {
    console.warn("Could not re-encode monitoring screenshot", error);

    // Small originals are safe to keep as-is; anything larger is rejected so a
    // malformed payload cannot bypass the 300KB budget.
    if (raw.length <= CAPTURE_TARGET_BYTES) {
      return { buffer: raw, ...detected, width: 0, height: 0 };
    }

    throw new Error("Capture image could not be processed");
  }
};

export type Requester = {
  userId: string;
  role: string;
};

const uploadsRoot = () =>
  process.env.MONITORING_UPLOADS_DIR || path.join(process.cwd(), "uploads", "monitoring");

const clampInt = (value: unknown, max: number) => {
  const parsed = Math.round(Number(value) || 0);
  return Math.min(max, Math.max(0, parsed));
};

// Fluid shifts have no scheduled end, so the displayed plan assumes a standard
// 8-hour work window; actual captures continue until the shift ends.
const DEFAULT_FLUID_WINDOW_MINUTES = 8 * 60;

export const plannedCaptureCount = (
  startedAt: Date,
  scheduledEndTime?: Date | null
) => {
  const startMs = new Date(startedAt).getTime();
  const endMs = scheduledEndTime ? new Date(scheduledEndTime).getTime() : 0;
  const windowMinutes = endMs > startMs
    ? Math.ceil((endMs - startMs) / 60_000)
    : DEFAULT_FLUID_WINDOW_MINUTES;

  return Math.min(
    MAX_CAPTURES,
    Math.max(1, Math.ceil(windowMinutes / CAPTURE_INTERVAL_MINUTES))
  );
};

async function assertShiftIsOwnedAndActive(userId: string, shiftId: string) {
  if (!ShiftSession.findOne) throw new Error("Database not connected");

  const shift = await ShiftSession.findOne({ _id: shiftId, userId }).select("_id status");

  if (!shift) throw new Error("Shift not found");
  if (shift.status !== "active") throw new Error("Shift is not active");

  return shift;
}

export const ensureMonitoringSession = async (
  userId: string,
  shiftId: string,
  scheduleType: "time_managed" | "fluid" = "time_managed"
) => {
  // The shift is needed both to size the capture plan and to decide whether a
  // monitoring session that was closed by a page unload is safe to resume.
  const shift = await ShiftSession.findById(shiftId).select(
    "userId status scheduledEndTime scheduleType"
  );

  // This is the only worker-writable session-creation path, so never let a
  // token create (or claim) a monitoring session for another worker's shift.
  if (!shift || String(shift.userId) !== String(userId)) {
    throw new Error("Shift not found for this worker");
  }

  const existing = await MonitoringSession.findOne({ shiftSessionId: shiftId });
  const shiftIsActive = shift.status === "active";

  if (existing) {
    if (existing.status !== "active" && shiftIsActive) {
      // A browser unload/reload used to mark the monitoring session completed,
      // which silently blocked every later screenshot upload for the shift.
      // The shift lifecycle is the source of truth: if the shift is active,
      // resume the session so the next page load can keep capturing.
      existing.status = "active";
      existing.endedAt = undefined;
      await existing.save();
    }

    // A browser page load also lands here. Re-send the handoff so an agent
    // whose registration raced with clock-in still takes over instead of
    // silently leaving the worker on browser capture. Never restart tracking
    // for a shift that has already ended.
    if (existing.status === "active" && shiftIsActive) {
      const delivered = notifyMonitoringAgent(userId, {
        action: "START_MONITORING",
        shiftId,
        capturesTaken: existing.captures.length,
        captureIntervalMinutes: CAPTURE_INTERVAL_MINUTES,
        startedAt: existing.startedAt.toISOString(),
      });

      if (delivered && !existing.desktopAgentActive) {
        await markDesktopAgentActive(userId, true).catch(() => undefined);
      }
    }

    return existing;
  }

  if (!shiftIsActive) {
    throw new Error("Shift is not active");
  }

  // The plan is the expected screenshot count at the fixed 15-minute cadence
  // across the scheduled window; fluid shifts fall back to a standard window.
  const scheduledEndTime = shift?.scheduledEndTime ? new Date(shift.scheduledEndTime) : null;
  const resolvedScheduleType = shift?.scheduleType || scheduleType;

  const session = await MonitoringSession.create({
    userId,
    shiftSessionId: shiftId,
    scheduleType: resolvedScheduleType,
    status: "active",
    startedAt: new Date(),
    capturePlan: plannedCaptureCount(new Date(), scheduledEndTime),
    captures: [],
    mouseSamples: [],
    mouseTotals: {},
  }).catch(async (error: any) => {
    // Clock-in and the first browser page load can race on session creation;
    // the unique shiftSessionId index makes one of them lose. Reuse the winner.
    if (error?.code === 11000) {
      const raced = await MonitoringSession.findOne({ shiftSessionId: shiftId });
      if (raced) return raced;
    }

    throw error;
  });

  // If the worker's desktop agent is already connected, hand the new shift to
  // it immediately. Without this an agent that connected before clock-in never
  // starts desktop monitoring, so the worker silently falls back to browser
  // capture (which needs a fresh screen-share grant) while a co-worker with a
  // reconnecting agent gets desktop captures — different counts for the same
  // shift length. Starting it here keeps every agent on the same schedule.
  const delivered = notifyMonitoringAgent(userId, {
    action: "START_MONITORING",
    shiftId,
    capturesTaken: session.captures.length,
    captureIntervalMinutes: CAPTURE_INTERVAL_MINUTES,
    startedAt: session.startedAt.toISOString(),
  });

  if (delivered) {
    await markDesktopAgentActive(userId, true).catch(() => undefined);
  }

  return session;
};

export const addMouseSamples = async (
  userId: string,
  shiftId: string,
  samples: any[],
  source: "browser" | "desktop" = "browser"
) => {
  await assertShiftIsOwnedAndActive(userId, shiftId);

  if (!Array.isArray(samples) || !samples.length) {
    throw new Error("samples must be a non-empty list");
  }

  // One request per client minute; cap the batch so a buggy client cannot
  // balloon a single write.
  const bounded = samples.slice(0, 10).map((sample) => ({
    at: new Date(sample.at),
    movements: clampInt(sample.movements, MAX_SAMPLE_VALUES.movements),
    distancePx: clampInt(sample.distancePx, MAX_SAMPLE_VALUES.distancePx),
    clicks: clampInt(sample.clicks, MAX_SAMPLE_VALUES.clicks),
    scrolls: clampInt(sample.scrolls, MAX_SAMPLE_VALUES.scrolls),
  })).filter((sample) => !Number.isNaN(sample.at.getTime()));

  if (!bounded.length) {
    throw new Error("No valid samples provided");
  }

  const movements = bounded.reduce((sum, s) => sum + s.movements, 0);
  const distancePx = bounded.reduce((sum, s) => sum + s.distancePx, 0);
  const clicks = bounded.reduce((sum, s) => sum + s.clicks, 0);
  const scrolls = bounded.reduce((sum, s) => sum + s.scrolls, 0);

  // $slice keeps only the most recent samples so the document cannot grow
  // without bound; totals live in a separate increments object.
  const updated = await MonitoringSession.findOneAndUpdate(
    {
      shiftSessionId: shiftId,
      userId,
      status: "active",
      // While the desktop agent owns the shift, browser batches are ignored so
      // the handover window cannot double-count mouse activity.
      ...(source === "browser" ? { desktopAgentActive: { $ne: true } } : {}),
    } as any,
    {
      $push: {
        mouseSamples: {
          $each: bounded,
          $slice: -MAX_MOUSE_SAMPLES,
        },
      },
      $inc: {
        "mouseTotals.movements": movements,
        "mouseTotals.distancePx": distancePx,
        "mouseTotals.clicks": clicks,
        "mouseTotals.scrolls": scrolls,
        "mouseTotals.sampleCount": bounded.length,
      },
    },
    { new: true, upsert: false }
  );

  if (!updated && source === "browser") {
    // The batch was skipped because the desktop agent took over. Return the
    // current session so the browser receives the flag and stands down.
    return MonitoringSession.findOne({ shiftSessionId: shiftId, userId, status: "active" });
  }

  return updated;
};

export const addCapture = async (
  userId: string,
  shiftId: string,
  image: Buffer,
  width = 0,
  height = 0,
  source: "browser" | "desktop" = "browser",
  // v2 clients align captures to fixed slots and can be de-duplicated. Older
  // agents (no protocol marker) keep the previous best-effort behaviour so an
  // un-updated desktop install is not silently starved of screenshots.
  protocol = 1
) => {
  await assertShiftIsOwnedAndActive(userId, shiftId);

  if (!image || image.length < 1024) {
    throw new Error("Capture payload is empty or too small");
  }

  // Accept the formats the browser and desktop agent can produce. The bytes are
  // re-encoded to WebP below, so the stored file type never depends on which
  // capture path the worker happened to use.
  const detected = detectCaptureFormat(image);

  if (!detected) {
    throw new Error("Capture payload must be a JPEG, PNG or WebP image");
  }

  const session = await MonitoringSession.findOne({ shiftSessionId: shiftId, userId });

  if (!session) throw new Error("Monitoring session not found");
  if (session.status !== "active") throw new Error("Monitoring session has ended");

  const captureCount = session.captures.length;

  // Hard cap: the client cadence (one capture per 15-minute tick until end
  // shift) must never let the captures array grow without bound, even if a
  // client bug fires early or repeats.
  if (captureCount >= MAX_CAPTURES) {
    throw new Error("Capture limit reached for this shift");
  }

  // One capture per fixed cadence slot, measured from the monitoring session
  // start. Both the browser and a desktop agent can try to capture around a
  // handover (or a second tab, or a reconnect), which used to give one worker
  // extra screenshots. Whichever capture reaches the server first claims the
  // slot; the rest are rejected so every worker's count follows the same plan.
  // Browser uploads are always slot-checked; legacy desktop agents without a
  // protocol marker are exempt until they are updated.
  const now = new Date();
  const startedMsRaw = new Date(session.startedAt).getTime();
  const startedMs = Number.isFinite(startedMsRaw) ? startedMsRaw : now.getTime();
  const slot = Math.max(0, Math.floor((now.getTime() - startedMs) / CAPTURE_INTERVAL_MS));
  const slotStart = new Date(startedMs + slot * CAPTURE_INTERVAL_MS);
  const slotEnd = new Date(slotStart.getTime() + CAPTURE_INTERVAL_MS);
  const enforceSlot = protocol >= 2 || source === "browser";

  if (enforceSlot) {
    const slotAlreadyCaptured = (session.captures || []).some((capture: any) => {
      const capturedAt = new Date(capture.capturedAt).getTime();
      return capturedAt >= slotStart.getTime() && capturedAt < slotEnd.getTime();
    });

    if (slotAlreadyCaptured) {
      throw new Error("A screenshot was already recorded for this interval");
    }
  }

  const optimized = await optimizeCapture(image, detected);
  const finalWidth = optimized.width || clampInt(width, 100_000);
  const finalHeight = optimized.height || clampInt(height, 100_000);

  const dir = path.join(uploadsRoot(), String(session._id));
  await fs.promises.mkdir(dir, { recursive: true });

  const seq = captureCount + 1;
  const fileName = `${seq}-${Date.now()}.${optimized.extension}`;
  const filePath = path.join(dir, fileName);

  try {
    await fs.promises.writeFile(filePath, optimized.buffer);

    const updated = await MonitoringSession.findOneAndUpdate(
      {
        _id: session._id,
        status: "active",
        // Conditional push keeps the array bounded even under races.
        [`captures.${MAX_CAPTURES - 1}`]: { $exists: false },
        // Same-slot uploads are rejected atomically for slot-enforced clients,
        // not just by the pre-check above.
        ...(enforceSlot
          ? {
              captures: {
                $not: {
                  $elemMatch: {
                    capturedAt: { $gte: slotStart, $lt: slotEnd },
                  },
                },
              },
            }
          : {}),
      } as any,
      {
        $push: {
          captures: {
            seq,
            capturedAt: now,
            filePath,
            sizeBytes: optimized.buffer.length,
            width: finalWidth,
            height: finalHeight,
            mimeType: optimized.mimeType,
            source,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      await fs.promises.unlink(filePath).catch(() => undefined);
      throw new Error(
        "Capture was not recorded; the shift limit was reached or this interval already has a screenshot"
      );
    }

    return {
      seq,
      capturedAt: now,
      captureCount: updated.captures.length,
      capturePlan: session.capturePlan,
      sizeBytes: optimized.buffer.length,
      mimeType: optimized.mimeType,
      width: finalWidth,
      height: finalHeight,
    };
  } catch (error) {
    await fs.promises.unlink(filePath).catch(() => undefined);
    throw error;
  }
};

export const endMonitoringSession = async (shiftId: string, status: "completed" | "expired" = "completed") => {
  // Idempotent: safe to call from both manual end-shift and auto-close paths.
  const previous = await MonitoringSession.findOneAndUpdate(
    { shiftSessionId: shiftId, status: "active" },
    { $set: { status, endedAt: new Date() } },
    { new: false }
  );

  if (previous) {
    // Tell a connected desktop agent to stop tracking this shift.
    notifyMonitoringAgent(previous.userId, {
      action: "STOP_MONITORING",
      shiftId: String(shiftId),
    });
  }

  return previous;
};

// Desktop agent presence -----------------------------------------------------

export const markDesktopAgentActive = async (userId: string, active: boolean) => {
  const update = active
    ? { $set: { desktopAgentActive: true, desktopAgentAt: new Date() } }
    : { $set: { desktopAgentActive: false } };

  await MonitoringSession.findOneAndUpdate(
    { userId: String(userId), status: "active" },
    update
  );
};

// Everything a connected desktop agent needs to take over the remaining
// capture plan and desktop-wide mouse tracking for an active shift.
export const getDesktopMonitoringHandoff = async (userId: string) => {
  const session = await MonitoringSession.findOne({
    userId: String(userId),
    status: "active",
  });

  if (!session) return null;

  const shift = await ShiftSession.findById(session.shiftSessionId).select(
    "status scheduledEndTime"
  );

  if (!shift || shift.status !== "active") return null;

  const capturesTaken = session.captures.length;

  // Legacy agents (v1.0.x) ignore captureIntervalMinutes and instead schedule
  // capturePlan - capturesTaken randomized captures across the remaining
  // window (clamped to 10 on their side). Report the plan as the remaining
  // 15-minute slots so un-updated agents still land near the cadence when
  // they reconnect; current agents ignore this field entirely.
  const now = Date.now();
  const scheduledEndMs = shift.scheduledEndTime ? new Date(shift.scheduledEndTime).getTime() : 0;
  const remainingMs = scheduledEndMs > now
    ? scheduledEndMs - now
    : DEFAULT_FLUID_WINDOW_MINUTES * 60_000;
  const legacyCapturePlan = capturesTaken + Math.ceil(remainingMs / (CAPTURE_INTERVAL_MINUTES * 60_000));

  return {
    shiftId: String(session.shiftSessionId),
    capturePlan: legacyCapturePlan,
    capturesTaken,
    // Clients schedule one screenshot per tick of this cadence until end shift.
    captureIntervalMinutes: CAPTURE_INTERVAL_MINUTES,
    // Aligning the cadence to the session start (instead of the moment the
    // agent reconnects) keeps reconnects and handovers on the same slots as
    // every other worker.
    startedAt: session.startedAt.toISOString(),
    scheduledEndTime: shift.scheduledEndTime ? new Date(shift.scheduledEndTime).toISOString() : null,
  };
};

// Lightweight state probe for the browser page: lets it detect that a desktop
// agent has taken over (or left) and resume browser-side tracking accordingly.
export const getMonitoringSessionState = async (userId: string, shiftId: string) => {
  const session = await MonitoringSession.findOne({
    shiftSessionId: shiftId,
    userId: String(userId),
  });

  if (!session) return null;

  return {
    status: session.status,
    desktopAgentActive: Boolean(session.desktopAgentActive),
    captureCount: session.captures.length,
    capturePlan: session.capturePlan,
    captureIntervalMinutes: CAPTURE_INTERVAL_MINUTES,
    startedAt: session.startedAt.toISOString(),
  };
};

async function assertMonitoringAccess(requester: Requester, session: any) {
  if (requester.role === "admin") return;

  if (requester.role === "supervisor") {
    const supervisor = await User.findById(requester.userId).select("assignedAgentIds");
    const assigned = (supervisor?.assignedAgentIds || []).map((id: any) => String(id));
    if (assigned.includes(String(session.userId))) return;
    throw new Error("You are not allowed to view this agent's monitoring data");
  }

  if (String(session.userId) === String(requester.userId)) return;

  throw new Error("You are not allowed to view this monitoring data");
}

export const getShiftMonitoring = async (shiftId: string, requester: Requester) => {
  const session = await MonitoringSession.findOne({ shiftSessionId: shiftId });

  if (!session) return null;

  await assertMonitoringAccess(requester, session);

  const shift = await ShiftSession.findById(shiftId).select(
    "userId clockInTime clockOutTime scheduledStartTime scheduledEndTime status totalWorkedMinutes totalBreakMinutes scheduleType attendanceStatus"
  );

  return {
    monitoring: {
      _id: session._id,
      userId: session.userId,
      shiftSessionId: session.shiftSessionId,
      scheduleType: session.scheduleType,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      capturePlan: session.capturePlan,
      captures: session.captures.map((capture: any) => ({
        _id: capture._id,
        seq: capture.seq,
        capturedAt: capture.capturedAt,
        sizeBytes: capture.sizeBytes,
        width: capture.width,
        height: capture.height,
        mimeType: capture.mimeType || "image/jpeg",
        source: capture.source || "browser",
      })),
      mouseTotals: session.mouseTotals,
      // Downsample to at most 240 points for charting so responses stay small.
      mouseSamples: downsampleSamples(session.mouseSamples, 240),
    },
    shift,
  };
};

const downsampleSamples = (samples: any[], maxPoints: number) => {
  if (samples.length <= maxPoints) return samples;

  const bucketSize = Math.ceil(samples.length / maxPoints);
  const reduced: any[] = [];

  for (let index = 0; index < samples.length; index += bucketSize) {
    const bucket = samples.slice(index, index + bucketSize);
    reduced.push({
      at: bucket[0].at,
      movements: bucket.reduce((sum, s) => sum + (s.movements || 0), 0),
      distancePx: bucket.reduce((sum, s) => sum + (s.distancePx || 0), 0),
      clicks: bucket.reduce((sum, s) => sum + (s.clicks || 0), 0),
      scrolls: bucket.reduce((sum, s) => sum + (s.scrolls || 0), 0),
    });
  }

  return reduced;
};

export const listUserMonitoring = async (targetUserId: string, requester: Requester, limit = 20) => {
  if (requester.role === "supervisor") {
    const supervisor = await User.findById(requester.userId).select("assignedAgentIds");
    const assigned = (supervisor?.assignedAgentIds || []).map((id: any) => String(id));
    if (!assigned.includes(String(targetUserId))) {
      throw new Error("You are not allowed to view this agent's monitoring data");
    }
  } else if (requester.role !== "admin" && String(targetUserId) !== String(requester.userId)) {
    throw new Error("You are not allowed to view this monitoring data");
  }

  const boundedLimit = Math.min(50, Math.max(1, Math.round(Number(limit) || 20)));

  // Aggregation keeps the payload small: no raw mouse samples and only capture
  // counts, plus the joined shift summary for the dashboard list.
  return MonitoringSession.aggregate([
    { $match: { userId: String(targetUserId) } },
    { $sort: { startedAt: -1 } },
    { $limit: boundedLimit },
    {
      $lookup: {
        from: "shiftsessions",
        localField: "shiftSessionId",
        foreignField: "_id",
        as: "shift",
        pipeline: [
          {
            $project: {
              clockInTime: 1,
              clockOutTime: 1,
              status: 1,
              attendanceStatus: 1,
              scheduleType: 1,
              totalWorkedMinutes: 1,
              totalBreakMinutes: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: "$shift", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        mouseSamples: 0,
        "captures.filePath": 0,
      },
    },
    {
      $addFields: {
        captureCount: { $size: "$captures" },
      },
    },
  ]);
};

export const readCaptureFile = async (captureId: string, requester: Requester) => {
  const session = await MonitoringSession.findOne({ "captures._id": captureId });

  if (!session) throw new Error("Capture not found");

  await assertMonitoringAccess(requester, session);

  const capture = session.captures.id(captureId);

  if (!capture) throw new Error("Capture not found");

  return { capture, session };
};
