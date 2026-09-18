import path from "path";
import fs from "fs";
import crypto from "crypto";
import ShiftSession from "../../models/ShiftSession";
import MonitoringSession, {
  MAX_CAPTURES,
  MAX_MOUSE_SAMPLES,
  MIN_CAPTURE_PLAN,
} from "../../models/MonitoringSession";
import User from "../../models/User";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const MAX_SAMPLE_VALUES = {
  movements: 10_000,
  distancePx: 5_000_000,
  clicks: 600,
  scrolls: 600,
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

export const randomCapturePlan = () => {
  // Between 7 and 10 automatic screenshots per work window (inclusive).
  return MIN_CAPTURE_PLAN + crypto.randomInt(0, 4);
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
  const existing = await MonitoringSession.findOne({ shiftSessionId: shiftId });

  if (existing) return existing;

  return MonitoringSession.create({
    userId,
    shiftSessionId: shiftId,
    scheduleType,
    status: "active",
    startedAt: new Date(),
    capturePlan: randomCapturePlan(),
    captures: [],
    mouseSamples: [],
    mouseTotals: {},
  });
};

export const addMouseSamples = async (
  userId: string,
  shiftId: string,
  samples: any[]
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
  return MonitoringSession.findOneAndUpdate(
    { shiftSessionId: shiftId, userId, status: "active" },
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
};

export const addCapture = async (
  userId: string,
  shiftId: string,
  image: Buffer,
  width = 0,
  height = 0
) => {
  await assertShiftIsOwnedAndActive(userId, shiftId);

  if (!image || image.length < 1024) {
    throw new Error("Capture payload is empty or too small");
  }

  // Reject non-JPEG payloads early instead of storing arbitrary bytes.
  if (!image.subarray(0, 3).equals(JPEG_MAGIC)) {
    throw new Error("Capture payload must be a JPEG image");
  }

  const session = await MonitoringSession.findOne({ shiftSessionId: shiftId, userId });

  if (!session) throw new Error("Monitoring session not found");
  if (session.status !== "active") throw new Error("Monitoring session has ended");

  const captureCount = session.captures.length;
  const plan = Math.min(MAX_CAPTURES, Math.max(MIN_CAPTURE_PLAN, session.capturePlan));

  // Hard cap: server refuses anything beyond min(plan, MAX_CAPTURES).
  if (captureCount >= Math.min(plan, MAX_CAPTURES)) {
    throw new Error("Capture limit reached for this shift");
  }

  const dir = path.join(uploadsRoot(), String(session._id));
  await fs.promises.mkdir(dir, { recursive: true });

  const seq = captureCount + 1;
  const fileName = `${seq}-${Date.now()}.jpg`;
  const filePath = path.join(dir, fileName);

  await fs.promises.writeFile(filePath, image);

  try {
    const updated = await MonitoringSession.findOneAndUpdate(
      {
        _id: session._id,
        // Conditional push keeps the array bounded even under races.
        [`captures.${MAX_CAPTURES - 1}`]: { $exists: false },
      },
      {
        $push: {
          captures: {
            seq,
            capturedAt: new Date(),
            filePath,
            sizeBytes: image.length,
            width: clampInt(width, 100_000),
            height: clampInt(height, 100_000),
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      await fs.promises.unlink(filePath).catch(() => undefined);
      throw new Error("Capture limit reached for this shift");
    }

    return {
      seq,
      capturedAt: updated.captures[updated.captures.length - 1]?.capturedAt || new Date(),
      captureCount: updated.captures.length,
      capturePlan: plan,
    };
  } catch (error) {
    await fs.promises.unlink(filePath).catch(() => undefined);
    throw error;
  }
};

export const endMonitoringSession = async (shiftId: string, status: "completed" | "expired" = "completed") => {
  // Idempotent: safe to call from both manual end-shift and auto-close paths.
  return MonitoringSession.findOneAndUpdate(
    { shiftSessionId: shiftId, status: "active" },
    { $set: { status, endedAt: new Date() } },
    { new: false }
  );
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
