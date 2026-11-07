import ShiftAnalysis, {
  IAnalysisMetrics,
  IAnalysisScreenBlock,
} from "../../models/ShiftAnalysis";
import PeriodAnalysis from "../../models/PeriodAnalysis";
import ShiftEvent from "../../models/ShiftEvent";
import ShiftSession from "../../models/ShiftSession";
import ShiftTemplate from "../../models/shiftTemplate.model";
import MonitoringSession from "../../models/MonitoringSession";
import User from "../../models/User";
import type { IActivityNarration } from "../../models/ActivityNarration";
import ActivityNarration from "../../models/ActivityNarration";
import { aiConfig } from "../ai/ai.config";
import { aiConfigured, callAiJson } from "../ai/ai.client";
import { assertCanViewWorker, assignedAgentIdsFor, type Requester } from "./analysis.access";
import {
  ensureActivityNarration,
  generateActivityNarration,
  getActivityNarration,
} from "../vision/activityNarration.service";
import { businessTimeZone, visionConfig } from "../vision/vision.config";
import { formatCaptureTime, formatWindow } from "../vision/vision.time";
import {
  buildHourlyActivity,
  clampScore,
  deriveShiftMetrics,
  toDayKey,
} from "./analysis.metrics";
import {
  buildAggregatePrompt,
  buildFallbackPeriodReport,
  buildFallbackShiftReport,
  buildShiftPrompt,
  deterministicShiftCharts,
  sanitizePeriodReport,
  sanitizeShiftReport,
} from "./analysis.prompts";
import type {
  AggregateCapture,
  AggregateContext,
  AggregatePeriodSummary,
  AggregateShiftSummary,
  AggregateStoryBeat,
  AggregateTotals,
  AggregateWorkerRow,
  PeriodNarrative,
  ShiftAnalysisContext,
  ShiftReportPayload,
  ShiftScreenBlock,
} from "./analysis.types";

// Bounds the automatic backfill sweep so a cold start cannot flood the queue.
const SWEEP_LOOKBACK_DAYS = 7;
const SWEEP_MAX_SHIFTS = 150;
const PDF_CAPTURE_COUNT = 6;
/** Shift screenshots a block may be paired with for the report's evidence grid. */
const CAPTURE_MATCH_WINDOW_MS = 45 * 60_000;
const AGGREGATE_MAX_DAYS = 366;
const AGGREGATE_NARRATION_LIMIT = 60;
const AGGREGATE_STORY_BEATS = 30;
const AGGREGATE_CAPTURE_LIMIT = 12;
const AGGREGATE_SHIFT_LOG_LIMIT = 150;

// ---------------------------------------------------------------------------
// Public serialisation — the vendor/model identity never leaves the server.
// ---------------------------------------------------------------------------
const normalizeSource = (value: unknown): "ai" | "fallback" =>
  String(value || "").toLowerCase() === "fallback" ? "fallback" : "ai";

const normalizeBlockSource = (value: unknown) => {
  const source = String(value || "");
  if (source === "deterministic" || source === "ocr") return source;
  return "ai";
};

const serializeShiftAnalysis = (doc: any) => {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  delete plain.aiModel;
  delete plain.error;
  plain.source = normalizeSource(plain.source);
  if (plain.screenActivity?.blocks) {
    plain.screenActivity.blocks = plain.screenActivity.blocks.map((block: any) => ({
      ...block,
      source: normalizeBlockSource(block.source),
    }));
  }
  return plain;
};

const serializePeriodAnalysis = (doc: any) => {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  delete plain.aiModel;
  delete plain.error;
  plain.source = normalizeSource(plain.source);
  return plain;
};

const serializeNarration = (doc: any) => {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  delete plain.aiModel;
  delete plain.error;
  plain.blocks = (plain.blocks || []).map((block: any) => ({
    ...block,
    source: normalizeBlockSource(block.source),
  }));
  plain.source =
    plain.source === "none" ? "none" : plain.source === "ocr" ? "ocr" : normalizeSource(plain.source);
  return plain;
};

// ---------------------------------------------------------------------------
// Metric collection
// ---------------------------------------------------------------------------
const nearestCapture = (captures: any[], at: Date) => {
  let best: any = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const capture of captures || []) {
    const delta = Math.abs(new Date(capture.capturedAt).getTime() - at.getTime());
    if (delta < bestDelta) {
      best = capture;
      bestDelta = delta;
    }
  }

  if (!best || bestDelta > CAPTURE_MATCH_WINDOW_MS) return null;
  return best;
};

const buildScreenBlocks = (
  narration: IActivityNarration | null,
  captures: any[]
): ShiftScreenBlock[] => {
  const timeZone = businessTimeZone();
  const withSummary = (narration?.blocks || []).filter((block) => block.summary);
  // Low-confidence OCR-only windows add little narrative value, but a shift
  // where they are the only evidence should still be described.
  const confident = withSummary.filter(
    (block) => block.confidence >= 35 || block.activity === "idle"
  );
  const chosen = confident.length ? confident : withSummary;

  return chosen.map((block) => {
    const capture = nearestCapture(captures, new Date(block.startedAt));
    return {
      index: block.index,
      window: formatWindow(block.startedAt, block.endedAt, timeZone),
      startedAt: new Date(block.startedAt).toISOString(),
      endedAt: new Date(block.endedAt).toISOString(),
      summary: block.summary,
      apps: block.apps || [],
      tasks: block.tasks || [],
      activity: block.activity,
      evidence: block.evidence || "",
      concerns: block.concerns || [],
      confidence: block.confidence || 0,
      source: block.source,
      captureId: capture ? String(capture._id) : null,
      capturedAt: capture ? new Date(capture.capturedAt).toISOString() : null,
    };
  });
};

const collectShiftAnalysisContext = async (shift: any): Promise<ShiftAnalysisContext> => {
  const [events, monitoring, template, worker, narration] = await Promise.all([
    ShiftEvent.find({ shiftId: shift._id }).sort({ timestamp: 1 }).lean(),
    MonitoringSession.findOne({ shiftSessionId: shift._id }).lean(),
    shift.shiftTemplateId
      ? ShiftTemplate.findById(shift.shiftTemplateId).select("name").lean()
      : Promise.resolve(null),
    User.findById(shift.userId).select("_id name email").lean(),
    getActivityNarration(String(shift._id)),
  ]);

  const eventCounts: Record<string, number> = {};
  for (const event of events || []) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }

  const mouseSamples = monitoring?.mouseSamples || [];
  const activeSamples = mouseSamples.filter(
    (sample: any) =>
      (sample.movements || 0) > 0 || (sample.clicks || 0) > 0 || (sample.scrolls || 0) > 0
  ).length;
  const captures = (monitoring?.captures || [])
    .slice(-PDF_CAPTURE_COUNT)
    .map((capture: any) => ({
      captureId: capture._id,
      capturedAt: capture.capturedAt,
    }));

  const metrics: IAnalysisMetrics = {
    scheduleType: shift.scheduleType || "time_managed",
    attendanceStatus: shift.attendanceStatus || "on_time",
    closureReason: shift.closureReason || "manual",
    scheduledMinutes: shift.scheduledMinutes || 0,
    workedMinutes: shift.totalWorkedMinutes || 0,
    breakMinutes: shift.totalBreakMinutes || 0,
    lateMinutes: shift.lateMinutes || 0,
    overtimeMinutes: shift.overtimeMinutes || 0,
    punctualityScore: clampScore(shift.punctualityScore),
    workScore: clampScore(shift.workScore),
    activityAdherenceScore: clampScore(shift.activityAdherenceScore),
    monitoring: {
      captureCount: monitoring?.captures?.length || 0,
      mouseMovements: monitoring?.mouseTotals?.movements || 0,
      mouseDistancePx: monitoring?.mouseTotals?.distancePx || 0,
      mouseClicks: monitoring?.mouseTotals?.clicks || 0,
      mouseScrolls: monitoring?.mouseTotals?.scrolls || 0,
      mouseSampleCount: monitoring?.mouseTotals?.sampleCount || 0,
      activeSamplePercent: monitoring?.mouseTotals?.sampleCount
        ? Math.round((activeSamples / monitoring.mouseTotals.sampleCount) * 100)
        : 0,
      hourlyActivity: buildHourlyActivity(mouseSamples),
    },
    captures,
    eventCounts,
  };

  const screenBlocks = buildScreenBlocks(
    (narration as IActivityNarration | null) || null,
    monitoring?.captures || []
  );

  const timeZone = businessTimeZone();
  const workDateKey = toDayKey(shift.scheduledStartTime || shift.clockInTime);
  const enrichedShift = {
    ...shift,
    workDateKey,
    clockInLabel: shift.clockInTime ? formatCaptureTime(shift.clockInTime, timeZone) : "",
    clockOutLabel: shift.clockOutTime ? formatCaptureTime(shift.clockOutTime, timeZone) : "",
    shiftStartLabel: shift.scheduledStartTime
      ? formatCaptureTime(shift.scheduledStartTime, timeZone)
      : "",
  };

  return {
    shift: enrichedShift,
    worker: worker
      ? { _id: String(worker._id), name: worker.name, email: worker.email }
      : null,
    templateName: template?.name || "Unassigned shift",
    metrics,
    derived: deriveShiftMetrics(metrics, screenBlocks),
    narration: (narration as IActivityNarration | null) || null,
    screen: {
      status: narration?.status || "none",
      overview: narration?.overview || "",
      coverage: {
        screenshots: narration?.coverage?.captures || 0,
        uniqueFrames: narration?.coverage?.uniqueFrames || 0,
        blocks: narration?.coverage?.blocks || screenBlocks.length,
        visionCalls: narration?.coverage?.visionCalls || 0,
      },
      blocks: screenBlocks,
    },
  };
};

// ---------------------------------------------------------------------------
// Shift report generation
// ---------------------------------------------------------------------------
export const generateShiftAnalysis = async (
  shiftId: string,
  options: { force?: boolean; requester?: Requester; narrate?: boolean } = {}
): Promise<any> => {
  const shift = await ShiftSession.findById(shiftId).lean();
  if (!shift) throw new Error("Shift not found");
  if (!["completed", "expired"].includes(shift.status)) {
    throw new Error("Analysis is only available for concluded shifts");
  }
  if (options.requester) {
    await assertCanViewWorker(options.requester, String(shift.userId));
  }

  const existing = await ShiftAnalysis.findOne({ shiftSessionId: shift._id });
  if (existing && !options.force) return serializeShiftAnalysis(existing);

  // Ground the narrative in what was actually on screen. Cached per shift, so a
  // regenerated analysis reuses the existing narration instead of paying again.
  if (options.narrate !== false && visionConfig.enabled && shift.attendanceStatus !== "absent") {
    await ensureActivityNarration(String(shift._id), {
      force: Boolean(options.force),
      budgetMs: visionConfig.inlineBudgetMs,
    });
  }

  const context = await collectShiftAnalysisContext(shift);
  const overallScore = clampScore(shift.kpiScore);
  const adherenceScore = clampScore(shift.adherenceScore);
  const absent = context.metrics.attendanceStatus === "absent";
  const fallback = buildFallbackShiftReport(context, overallScore);

  let report: ShiftReportPayload = fallback;
  let charts: ReturnType<typeof deterministicShiftCharts> = deterministicShiftCharts(
    context.metrics
  );
  let source: "ai" | "fallback" = "fallback";
  let error: string | undefined;

  if (absent) {
    // Absent shifts carry no telemetry worth a model call — narrate them locally.
    error = undefined;
  } else if (!aiConfigured()) {
    error = "AI analysis is not configured";
    console.warn("Shift analysis fell back to the offline report: no provider key configured");
  } else {
    try {
      const { systemPrompt, userPrompt } = buildShiftPrompt(context, overallScore);
      const result = await callAiJson({
        purpose: "analysis",
        system: systemPrompt,
        user: userPrompt,
        maxTokens: aiConfig.analysisMaxTokens,
        timeoutMs: aiConfig.analysisTimeoutMs,
        userId: context.worker?._id,
      });

      const sanitized = sanitizeShiftReport(result.data, context.metrics, fallback);
      const narrative = sanitized.report.narrative;
      if (narrative.executiveSummary.length >= 120 || narrative.sections.screen.length >= 80) {
        report = sanitized.report;
        charts = sanitized.charts;
        source = "ai";
      } else {
        error = "The analysis engine returned an incomplete report";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown analysis failure";
      console.error("Shift analysis failed, using the offline report:", error);
    }
  }

  const narration = context.narration;
  const screenActivityBlocks: IAnalysisScreenBlock[] = context.screen.blocks.map((block) => ({
    index: block.index,
    startedAt: new Date(block.startedAt),
    endedAt: new Date(block.endedAt),
    summary: block.summary,
    tasks: block.tasks,
    apps: block.apps,
    activity: block.activity,
    evidence: block.evidence,
    confidence: block.confidence,
    source: block.source,
    captureId: block.captureId ? (block.captureId as any) : null,
    capturedAt: block.capturedAt ? new Date(block.capturedAt) : null,
  }));

  const saved = await ShiftAnalysis.findOneAndUpdate(
    { shiftSessionId: shift._id },
    {
      userId: String(shift.userId),
      workDate: context.shift.workDateKey,
      status: "completed",
      source,
      aiModel: aiConfig.analysisModel,
      overallScore,
      adherenceScore,
      metrics: context.metrics,
      derived: context.derived,
      narrative: report.narrative,
      timeline: report.timeline,
      recommendations: report.recommendations,
      charts,
      screenActivity: narration
        ? {
            status: narration.status,
            overview: narration.overview,
            blocks: screenActivityBlocks,
            coverage: narration.coverage,
          }
        : null,
      generatedAt: new Date(),
      error: error || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return serializeShiftAnalysis(saved);
};

const queuedShiftIds = new Set<string>();
let analysisQueue: Promise<void> = Promise.resolve();

// Fire-and-forget entry point for shift-conclusion hooks: generations run
// sequentially (never in parallel) so bursts stay predictable.
// `narrate=false` is used by the backfill sweep: narrating 150 old shifts would
// be wasteful, so historical narration is an explicit CLI choice
// (`scripts/narrate-shifts.ts`).
export const enqueueShiftAnalysis = (shiftId: string, force = false, narrate = true) => {
  const key = `${shiftId}:${force ? "force" : "auto"}`;
  if (queuedShiftIds.has(key)) return;

  queuedShiftIds.add(key);
  analysisQueue = analysisQueue
    .then(async () => {
      // Narrate the screen first, off the request path: the analysis below then
      // consumes the cached blocks instead of waiting on vision calls.
      if (narrate) await ensureActivityNarration(shiftId);
      await generateShiftAnalysis(shiftId, { force, narrate });
    })
    .catch((error) => {
      console.error("Automatic shift analysis failed", shiftId, error);
    })
    .finally(() => queuedShiftIds.delete(key));
};

// Safety net: pick up concluded shifts that never got an analysis (e.g. the
// process restarted between shift close and generation).
export const sweepMissingShiftAnalyses = async () => {
  const since = new Date(Date.now() - SWEEP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const concluded = await ShiftSession.find({
    status: { $in: ["completed", "expired"] },
    kpiEvaluatedAt: { $gte: since },
  })
    .select("_id")
    .sort({ updatedAt: -1 })
    .limit(SWEEP_MAX_SHIFTS)
    .lean();

  if (!concluded.length) return 0;

  const ids = concluded.map((shift: any) => String(shift._id));
  const analysed = await ShiftAnalysis.find({ shiftSessionId: { $in: ids } })
    .select("shiftSessionId")
    .lean();
  const analysedIds = new Set(analysed.map((analysis: any) => String(analysis.shiftSessionId)));

  let enqueued = 0;
  for (const id of ids) {
    if (!analysedIds.has(id)) {
      enqueueShiftAnalysis(id, false, false);
      enqueued += 1;
    }
  }
  return enqueued;
};

// ---------------------------------------------------------------------------
// Read endpoints
// ---------------------------------------------------------------------------
export const listAnalysisWorkers = async (requester: Requester) => {
  const assignedAgentIds = await assignedAgentIdsFor(requester);

  const concludedUserIds = await ShiftSession.find({
    status: { $in: ["completed", "expired"] },
  }).distinct("userId");

  const userQuery = assignedAgentIds
    ? { _id: { $in: assignedAgentIds }, role: "agent" }
    : { _id: { $in: concludedUserIds } };

  const users = await User.find(userQuery)
    .select("_id name email role")
    .sort({ name: 1 })
    .lean();

  return users.map((user: any) => ({
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  }));
};

export const listWorkerConcludedShifts = async (requester: Requester, targetUserId: string) => {
  await assertCanViewWorker(requester, targetUserId);

  const shifts = await ShiftSession.find({
    userId: String(targetUserId),
    status: { $in: ["completed", "expired"] },
  })
    .select("_id clockInTime clockOutTime attendanceStatus closureReason kpiScore scheduledStartTime")
    .sort({ clockInTime: -1 })
    .limit(60)
    .lean();

  if (!shifts.length) return [];

  const analyses = await ShiftAnalysis.find({
    shiftSessionId: { $in: shifts.map((shift: any) => shift._id) },
  })
    .select("shiftSessionId status source generatedAt")
    .lean();
  const analysisByShift = new Map(
    analyses.map((analysis: any) => [String(analysis.shiftSessionId), analysis])
  );

  return shifts.map((shift: any) => {
    const analysis = analysisByShift.get(String(shift._id)) as any;
    return {
      shiftId: String(shift._id),
      workDate: toDayKey(shift.scheduledStartTime || shift.clockInTime),
      clockInTime: shift.clockInTime,
      clockOutTime: shift.clockOutTime,
      attendanceStatus: shift.attendanceStatus,
      closureReason: shift.closureReason,
      kpiScore: clampScore(shift.kpiScore),
      analysis: analysis
        ? {
            status: analysis.status as string,
            source: normalizeSource(analysis.source),
            generatedAt: analysis.generatedAt as Date,
          }
        : null,
    };
  });
};

export const getSavedShiftAnalysis = async (requester: Requester, shiftId: string) => {
  const shift = await ShiftSession.findById(shiftId).select("userId").lean();
  if (!shift) throw new Error("Shift not found");
  await assertCanViewWorker(requester, String(shift.userId));

  return serializeShiftAnalysis(await ShiftAnalysis.findOne({ shiftSessionId: shift._id }));
};

// ---------------------------------------------------------------------------
// Screen narration access — the per-block "what was on screen" detail that is
// too large to embed in the analysis list endpoints.
// ---------------------------------------------------------------------------
export const getShiftActivityNarration = async (requester: Requester, shiftId: string) => {
  const shift = await ShiftSession.findById(shiftId).select("userId").lean();
  if (!shift) throw new Error("Shift not found");
  await assertCanViewWorker(requester, String(shift.userId));

  return serializeNarration(await getActivityNarration(shiftId));
};

export const runShiftActivityNarration = async (
  requester: Requester,
  shiftId: string,
  force = true
) => {
  const shift = await ShiftSession.findById(shiftId).select("userId").lean();
  if (!shift) throw new Error("Shift not found");
  await assertCanViewWorker(requester, String(shift.userId));

  const narration = await generateActivityNarration(shiftId, { force });
  return serializeNarration(narration);
};

export const getAnalysisOverview = async (requester: Requester) => {
  const assignedAgentIds = await assignedAgentIdsFor(requester);
  const userFilter = assignedAgentIds ? { userId: { $in: assignedAgentIds } } : {};

  const [totalAnalyses, avgResult, aiCount, recentAnalyses] = await Promise.all([
    ShiftAnalysis.countDocuments({ ...userFilter, status: "completed" }),
    ShiftAnalysis.aggregate([
      { $match: { ...userFilter, status: "completed" } },
      { $group: { _id: null, average: { $avg: "$overallScore" } } },
    ]),
    ShiftAnalysis.countDocuments({
      ...userFilter,
      status: "completed",
      // Legacy records predate the current source naming; anything that is not a
      // deterministic fallback was written by the analysis engine.
      source: { $ne: "fallback" },
    }),
    ShiftAnalysis.countDocuments({
      ...userFilter,
      status: "completed",
      generatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    totalAnalyses,
    averageScore: avgResult.length ? clampScore(avgResult[0].average) : 0,
    aiAnalyses: aiCount,
    recentAnalyses,
  };
};

// ---------------------------------------------------------------------------
// Aggregate period analysis — per-worker rollup of saved shift analyses over a
// date range, the screenshot story of the period, and a long-form narrative.
// ---------------------------------------------------------------------------
const normalizeRange = (startDate: string, endDate: string) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
    throw new Error("Dates must use the YYYY-MM-DD format");
  }
  if (endDate < startDate) {
    throw new Error("The end date must be on or after the start date");
  }
  const days = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000;
  if (days > AGGREGATE_MAX_DAYS) {
    throw new Error("The period cannot exceed 366 days");
  }
  return { startDate, endDate };
};

const scopeKeyFor = (
  requester: Requester,
  assignedAgentIds: string[] | null,
  targetUserId?: string
) => `${assignedAgentIds ? requester.userId : "admin"}:${targetUserId || "all"}`;

const weekStartKey = (dayKey: string) => {
  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dayKey;
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

const sampleEvenly = <T>(items: T[], limit: number): T[] => {
  if (limit <= 0 || !items.length) return [];
  if (limit === 1) return [items[items.length - 1]];
  if (items.length <= limit) return items;
  const sampled: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(items[Math.round((index * (items.length - 1)) / (limit - 1))]);
  }
  return sampled;
};

const emptyTotals = (): AggregateTotals => ({
  workers: 0,
  analyses: 0,
  averageScore: 0,
  averageAdherence: 0,
  workedMinutes: 0,
  scheduledMinutes: 0,
  absentCount: 0,
  lateShifts: 0,
  lateMinutes: 0,
  overtimeMinutes: 0,
  breakMinutes: 0,
});

const emptyPeriod = (dayCount: number): AggregatePeriodSummary => ({
  dayCount,
  recordedDays: 0,
  attendance: { onTime: 0, late: 0, veryLate: 0, absent: 0, overtime: 0 },
  closures: [],
  hourlyActivity: [],
  weeklyTrend: [],
  topApps: [],
  topTasks: [],
  screen: { screenshots: 0, narratedShifts: 0, blocks: 0, focused: 0, mixed: 0, idle: 0 },
  utilisationPercent: 0,
  presencePercent: 0,
});

type AggregateBundle = {
  range: { startDate: string; endDate: string };
  targetUserId: string | null;
  totals: AggregateTotals;
  rows: AggregateWorkerRow[];
  period: AggregatePeriodSummary;
  story: AggregateStoryBeat[];
  captures: AggregateCapture[];
  shifts: AggregateShiftSummary[];
  workerScreenNotes: Record<string, string[]>;
};

const collectAggregateContext = async (
  requester: Requester,
  startDate: string,
  endDate: string,
  targetUserId?: string
): Promise<AggregateBundle> => {
  const range = normalizeRange(startDate, endDate);
  const assignedAgentIds = await assignedAgentIdsFor(requester);
  const dayCount =
    Math.round(
      (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / 86_400_000
    ) + 1;

  if (targetUserId) {
    // Workers outside the requester's scope (or unknown ids) are rejected here.
    await assertCanViewWorker(requester, targetUserId);
  }

  const match: Record<string, unknown> = {
    status: "completed",
    workDate: { $gte: range.startDate, $lte: range.endDate },
  };
  if (assignedAgentIds) match.userId = { $in: assignedAgentIds };
  if (targetUserId) match.userId = targetUserId;

  const analyses = await ShiftAnalysis.find(match)
    .select(
      "shiftSessionId userId workDate overallScore adherenceScore metrics narrative.headline screenActivity.coverage"
    )
    .sort({ workDate: 1, generatedAt: 1 })
    .limit(2000)
    .lean();

  if (!analyses.length) {
    return {
      range,
      targetUserId: targetUserId || null,
      totals: emptyTotals(),
      rows: [],
      period: emptyPeriod(dayCount),
      story: [],
      captures: [],
      shifts: [],
      workerScreenNotes: {},
    };
  }

  const users = await User.find({ _id: { $in: [...new Set(analyses.map((a: any) => a.userId))] } })
    .select("_id name email")
    .lean();
  const userById = new Map(users.map((user: any) => [String(user._id), user]));

  // Per-worker accumulators.
  type Acc = {
    row: AggregateWorkerRow;
    scoreSum: number;
    adherenceSum: number;
    punctualitySum: number;
    scheduledSum: number;
    workedSum: number;
    best: { date: string; score: number };
    worst: { date: string; score: number };
  };
  const accumulators = new Map<string, Acc>();

  let scoreSum = 0;
  let adherenceSum = 0;
  let workedMinutes = 0;
  let scheduledMinutes = 0;
  let breakMinutes = 0;
  let overtimeMinutes = 0;
  let absentCount = 0;
  let lateShifts = 0;
  let lateMinutes = 0;

  const hourlyTotals = new Map<string, number>();
  const weekTotals = new Map<string, { shifts: number; scoreSum: number; worked: number }>();
  const closures = new Map<string, number>();
  const attendance = { onTime: 0, late: 0, veryLate: 0, absent: 0, overtime: 0 };
  const recordedDays = new Set<string>();

  for (const analysis of analyses as any[]) {
    const userId = String(analysis.userId);
    const user = userById.get(userId);
    const name = user?.name || "Unknown worker";
    const score = clampScore(analysis.overallScore);
    const adherence = clampScore(analysis.adherenceScore);
    const metrics = analysis.metrics || {};
    const monitoring = metrics.monitoring || {};
    const scheduled = Number(metrics.scheduledMinutes) || 0;
    const worked = Number(metrics.workedMinutes) || 0;
    const breaks = Number(metrics.breakMinutes) || 0;
    const overtime = Number(metrics.overtimeMinutes) || 0;
    const late = Number(metrics.lateMinutes) || 0;
    const attendanceStatus = String(metrics.attendanceStatus || "on_time");
    const closure = String(metrics.closureReason || "manual");

    scoreSum += score;
    adherenceSum += adherence;
    workedMinutes += worked;
    scheduledMinutes += scheduled;
    breakMinutes += breaks;
    overtimeMinutes += overtime;
    lateMinutes += late;
    recordedDays.add(String(analysis.workDate));

    if (attendanceStatus === "absent") absentCount += 1;
    if (attendanceStatus === "late" || attendanceStatus === "very_late") lateShifts += 1;

    if (attendanceStatus === "absent") attendance.absent += 1;
    else if (attendanceStatus === "very_late") attendance.veryLate += 1;
    else if (attendanceStatus === "late") attendance.late += 1;
    else if (attendanceStatus === "overtime") attendance.overtime += 1;
    else attendance.onTime += 1;

    closures.set(closure, (closures.get(closure) || 0) + 1);

    for (const bucket of monitoring.hourlyActivity || []) {
      hourlyTotals.set(bucket.hour, (hourlyTotals.get(bucket.hour) || 0) + (bucket.activeMinutes || 0));
    }

    const week = weekStartKey(String(analysis.workDate));
    const weekEntry = weekTotals.get(week) || { shifts: 0, scoreSum: 0, worked: 0 };
    weekEntry.shifts += 1;
    weekEntry.scoreSum += score;
    weekEntry.worked += worked;
    weekTotals.set(week, weekEntry);

    let acc = accumulators.get(userId);
    if (!acc) {
      acc = {
        row: {
          userId,
          name,
          email: user?.email || "",
          shiftCount: 0,
          absentCount: 0,
          averageScore: 0,
          averageAdherence: 0,
          workedMinutes: 0,
          scheduledMinutes: 0,
          breakMinutes: 0,
          overtimeMinutes: 0,
          lateShifts: 0,
          lateMinutes: 0,
          averagePunctuality: 0,
          averageWorkedMinutes: 0,
          screenShifts: 0,
          screenBlocks: 0,
          focusedBlocks: 0,
          idleBlocks: 0,
          bestDate: String(analysis.workDate),
          bestScore: score,
          worstDate: String(analysis.workDate),
          worstScore: score,
          firstDate: String(analysis.workDate),
          lastDate: String(analysis.workDate),
          scoreSpread: 0,
        },
        scoreSum: 0,
        adherenceSum: 0,
        punctualitySum: 0,
        scheduledSum: 0,
        workedSum: 0,
        best: { date: String(analysis.workDate), score },
        worst: { date: String(analysis.workDate), score },
      };
      accumulators.set(userId, acc);
    }

    acc.row.shiftCount += 1;
    if (attendanceStatus === "absent") acc.row.absentCount += 1;
    if (attendanceStatus === "late" || attendanceStatus === "very_late") acc.row.lateShifts += 1;
    acc.row.lateMinutes += late;
    acc.row.workedMinutes += worked;
    acc.row.scheduledMinutes += scheduled;
    acc.row.breakMinutes += breaks;
    acc.row.overtimeMinutes += overtime;
    acc.row.screenBlocks += Number(analysis.screenActivity?.coverage?.blocks) || 0;
    if ((analysis.screenActivity?.coverage?.captures || 0) > 0) acc.row.screenShifts += 1;
    acc.scoreSum += score;
    acc.adherenceSum += adherence;
    acc.punctualitySum += clampScore(metrics.punctualityScore);
    acc.scheduledSum += scheduled;
    acc.workedSum += worked;
    acc.row.firstDate = String(analysis.workDate) < acc.row.firstDate ? String(analysis.workDate) : acc.row.firstDate;
    acc.row.lastDate = String(analysis.workDate) > acc.row.lastDate ? String(analysis.workDate) : acc.row.lastDate;
    if (score > acc.best.score) acc.best = { date: String(analysis.workDate), score };
    if (score < acc.worst.score) acc.worst = { date: String(analysis.workDate), score };
  }

  const rows: AggregateWorkerRow[] = [...accumulators.values()].map((acc) => {
    const row = acc.row;
    const count = Math.max(1, row.shiftCount);
    row.averageScore = Math.round(acc.scoreSum / count);
    row.averageAdherence = Math.round(acc.adherenceSum / count);
    row.averagePunctuality = Math.round(acc.punctualitySum / count);
    row.averageWorkedMinutes = Math.round(acc.workedSum / count);
    row.bestDate = acc.best.date;
    row.bestScore = acc.best.score;
    row.worstDate = acc.worst.date;
    row.worstScore = acc.worst.score;
    row.scoreSpread = acc.best.score - acc.worst.score;
    return row;
  });

  rows.sort((left, right) => right.averageScore - left.averageScore || left.name.localeCompare(right.name));

  const analysisCount = analyses.length;
  const totals: AggregateTotals = {
    workers: rows.length,
    analyses: analysisCount,
    averageScore: analysisCount ? Math.round(scoreSum / analysisCount) : 0,
    averageAdherence: analysisCount ? Math.round(adherenceSum / analysisCount) : 0,
    workedMinutes,
    scheduledMinutes,
    absentCount,
    lateShifts,
    lateMinutes,
    overtimeMinutes,
    breakMinutes,
  };

  // Screen narration: the storytelling layer. Only the most recent shifts in the
  // period are loaded, so a year-long report stays fast.
  const analysedByShiftId = new Map(
    (analyses as any[]).map((analysis) => [String(analysis.shiftSessionId), analysis])
  );
  const narrationShiftIds = [...analysedByShiftId.keys()].slice(-AGGREGATE_NARRATION_LIMIT);
  const [narrations, monitoringSessions] = await Promise.all([
    narrationShiftIds.length
      ? ActivityNarration.find({ shiftSessionId: { $in: narrationShiftIds } })
          .select("shiftSessionId userId overview status blocks coverage")
          .lean()
      : Promise.resolve([]),
    narrationShiftIds.length
      ? MonitoringSession.find({ shiftSessionId: { $in: narrationShiftIds } })
          .select("shiftSessionId captures")
          .lean()
      : Promise.resolve([]),
  ]);

  const capturesByShift = new Map<string, any[]>();
  for (const session of monitoringSessions as any[]) {
    capturesByShift.set(String(session.shiftSessionId), session.captures || []);
  }

  const storyAll: AggregateStoryBeat[] = [];
  const appCounts = new Map<string, number>();
  const taskCounts = new Map<string, number>();
  const workerNotes: Record<string, string[]> = {};
  const screenStats = { screenshots: 0, narratedShifts: 0, blocks: 0, focused: 0, mixed: 0, idle: 0 };
  const timeZone = businessTimeZone();

  for (const analysis of analyses as any[]) {
    screenStats.screenshots += Number(analysis.metrics?.monitoring?.captureCount) || 0;
  }

  for (const narration of narrations as any[]) {
    const shiftId = String(narration.shiftSessionId);
    const analysis = analysedByShiftId.get(shiftId);
    if (!analysis) continue;

    const worker = userById.get(String(analysis.userId));
    const workerName = worker?.name || "Unknown worker";
    const blocks = (narration.blocks || []).filter((block: any) => block.summary);
    if (!blocks.length) continue;

    screenStats.narratedShifts += 1;
    screenStats.blocks += blocks.length;

    if (!workerNotes[workerName]) workerNotes[workerName] = [];

    for (const block of blocks) {
      if (block.activity === "focused") screenStats.focused += 1;
      else if (block.activity === "mixed") screenStats.mixed += 1;
      else if (block.activity === "idle") screenStats.idle += 1;

      for (const app of block.apps || []) {
        appCounts.set(app, (appCounts.get(app) || 0) + 1);
      }
      for (const task of block.tasks || []) {
        taskCounts.set(task, (taskCounts.get(task) || 0) + 1);
      }

      if (block.summary && block.confidence >= 35) {
        storyAll.push({
          at: new Date(block.startedAt).toISOString(),
          label: formatWindow(block.startedAt, block.endedAt, timeZone),
          worker: workerName,
          date: String(analysis.workDate),
          summary: block.summary,
          apps: block.apps || [],
          tasks: block.tasks || [],
          activity: block.activity,
          confidence: block.confidence || 0,
          captureId: null,
          capturedAt: null,
          shiftId,
        });

        if (workerNotes[workerName].length < 3) {
          workerNotes[workerName].push(
            `${String(analysis.workDate)} ${formatWindow(
              block.startedAt,
              block.endedAt,
              timeZone
            )}: ${block.summary}`
          );
        }
      }
    }
  }

  storyAll.sort((left, right) => left.at.localeCompare(right.at));
  const story = sampleEvenly(storyAll, AGGREGATE_STORY_BEATS);

  // Pair the sampled beats with their nearest stored screenshot.
  for (const beat of story) {
    const captures = capturesByShift.get(beat.shiftId) || [];
    const nearest = nearestCapture(captures, new Date(beat.at));
    if (nearest) {
      beat.captureId = String(nearest._id);
      beat.capturedAt = new Date(nearest.capturedAt).toISOString();
    }
  }

  const captureMap = new Map<string, AggregateCapture>();
  for (const beat of story) {
    if (!beat.captureId || captureMap.has(beat.captureId)) continue;
    captureMap.set(beat.captureId, {
      captureId: beat.captureId,
      capturedAt: beat.capturedAt || beat.at,
      worker: beat.worker,
      date: beat.date,
      note: beat.summary,
      shiftId: beat.shiftId,
    });
  }
  const captures = sampleEvenly([...captureMap.values()], AGGREGATE_CAPTURE_LIMIT);

  const weeklyTrend = [...weekTotals.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([week, value]) => ({
      label: week,
      shifts: value.shifts,
      averageScore: value.shifts ? Math.round(value.scoreSum / value.shifts) : 0,
      workedMinutes: value.worked,
    }));

  const period: AggregatePeriodSummary = {
    dayCount,
    recordedDays: recordedDays.size,
    attendance,
    closures: [...closures.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count),
    hourlyActivity: [...hourlyTotals.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([hour, activeMinutes]) => ({ hour, activeMinutes })),
    weeklyTrend,
    topApps: [...appCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    topTasks: [...taskCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    screen: screenStats,
    utilisationPercent: scheduledMinutes ? Math.round((workedMinutes / scheduledMinutes) * 100) : 0,
    presencePercent: analysisCount
      ? Math.round(((analysisCount - absentCount) / analysisCount) * 100)
      : 0,
  };

  // Backfill focused/idle counts per worker from the narration blocks.
  for (const narration of narrations as any[]) {
    const shiftId = String(narration.shiftSessionId);
    const analysis = analysedByShiftId.get(shiftId) as any;
    if (!analysis) continue;
    const acc = accumulators.get(String(analysis.userId));
    if (!acc) continue;
    for (const block of narration.blocks || []) {
      if (block.activity === "focused") acc.row.focusedBlocks += 1;
      else if (block.activity === "idle") acc.row.idleBlocks += 1;
    }
  }

  const shifts: AggregateShiftSummary[] = analyses
    .map((analysis: any) => {
      const user = userById.get(String(analysis.userId));
      return {
        shiftId: String(analysis.shiftSessionId),
        date: String(analysis.workDate),
        worker: user?.name || "Unknown worker",
        userId: String(analysis.userId),
        score: clampScore(analysis.overallScore),
        adherence: clampScore(analysis.adherenceScore),
        attendance: String(analysis.metrics?.attendanceStatus || "on_time"),
        closure: String(analysis.metrics?.closureReason || "manual"),
        workedMinutes: Number(analysis.metrics?.workedMinutes) || 0,
        scheduledMinutes: Number(analysis.metrics?.scheduledMinutes) || 0,
        breakMinutes: Number(analysis.metrics?.breakMinutes) || 0,
        overtimeMinutes: Number(analysis.metrics?.overtimeMinutes) || 0,
        lateMinutes: Number(analysis.metrics?.lateMinutes) || 0,
        activePercent: clampScore(analysis.metrics?.monitoring?.activeSamplePercent),
        screenshots: Number(analysis.metrics?.monitoring?.captureCount) || 0,
        screenBlocks: Number(analysis.screenActivity?.coverage?.blocks) || 0,
        headline: String(analysis.narrative?.headline || ""),
      };
    })
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, AGGREGATE_SHIFT_LOG_LIMIT);

  return {
    range,
    targetUserId: targetUserId || null,
    totals,
    rows,
    period,
    story,
    captures,
    shifts,
    workerScreenNotes: workerNotes,
  };
};

export const getAggregateAnalysis = async (
  requester: Requester,
  startDate: string,
  endDate: string,
  targetUserId?: string
) => {
  const bundle = await collectAggregateContext(requester, startDate, endDate, targetUserId);
  const assignedAgentIds = await assignedAgentIdsFor(requester);
  const narrative = await PeriodAnalysis.findOne({
    rangeStart: bundle.range.startDate,
    rangeEnd: bundle.range.endDate,
    scopeKey: scopeKeyFor(requester, assignedAgentIds, targetUserId),
  }).sort({ generatedAt: -1 });

  return {
    startDate: bundle.range.startDate,
    endDate: bundle.range.endDate,
    targetUserId: bundle.targetUserId,
    totals: bundle.totals,
    rows: bundle.rows,
    period: bundle.period,
    story: bundle.story,
    captures: bundle.captures,
    shifts: bundle.shifts,
    narrative: serializePeriodAnalysis(narrative),
  };
};

const toPromptContext = (bundle: AggregateBundle): AggregateContext => ({
  range: bundle.range,
  totals: bundle.totals,
  rows: bundle.rows,
  period: bundle.period,
  story: bundle.story,
  captures: bundle.captures,
  shifts: bundle.shifts,
  workerScreenNotes: bundle.workerScreenNotes,
});

export const generateAggregateNarrative = async (
  requester: Requester,
  startDate: string,
  endDate: string,
  force = false,
  targetUserId?: string
): Promise<any> => {
  const bundle = await collectAggregateContext(requester, startDate, endDate, targetUserId);
  if (!bundle.rows.length) {
    throw new Error("No analyzed shifts fall within this period");
  }

  const assignedAgentIds = await assignedAgentIdsFor(requester);
  const scopeKey = scopeKeyFor(requester, assignedAgentIds, targetUserId);

  const existing = await PeriodAnalysis.findOne({
    rangeStart: bundle.range.startDate,
    rangeEnd: bundle.range.endDate,
    scopeKey,
  });
  if (existing && !force) return serializePeriodAnalysis(existing);

  const context = toPromptContext(bundle);
  const fallback = buildFallbackPeriodReport(context);
  let narrative: PeriodNarrative = fallback;
  let source: "ai" | "fallback" = "fallback";
  let error: string | undefined;

  if (!aiConfigured()) {
    error = "AI analysis is not configured";
    console.warn("Period report fell back to the offline report: no provider key configured");
  } else {
    try {
      const { systemPrompt, userPrompt } = buildAggregatePrompt(context);
      const result = await callAiJson({
        purpose: "aggregate",
        system: systemPrompt,
        user: userPrompt,
        maxTokens: aiConfig.aggregateMaxTokens,
        timeoutMs: aiConfig.aggregateTimeoutMs,
      });

      const sanitized = sanitizePeriodReport(result.data, bundle.rows, fallback);
      if (sanitized.executiveSummary.length >= 200 || sanitized.sections.screenStory.length >= 150) {
        narrative = sanitized;
        source = "ai";
      } else {
        error = "The analysis engine returned an incomplete period report";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown analysis failure";
      console.error("Period narrative failed, using the offline report:", error);
    }
  }

  const saved = await PeriodAnalysis.findOneAndUpdate(
    { rangeStart: bundle.range.startDate, rangeEnd: bundle.range.endDate, scopeKey },
    {
      rangeStart: bundle.range.startDate,
      rangeEnd: bundle.range.endDate,
      scopeKey,
      totals: bundle.totals,
      narrative,
      status: "completed",
      source,
      aiModel: aiConfig.analysisModel,
      generatedAt: new Date(),
      error: error || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return serializePeriodAnalysis(saved);
};
