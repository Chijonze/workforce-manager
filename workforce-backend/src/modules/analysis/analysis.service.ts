import ShiftAnalysis, {
  IAnalysisChartPoint,
  IAnalysisMetrics,
  IShiftAnalysis,
} from "../../models/ShiftAnalysis";
import ShiftEvent from "../../models/ShiftEvent";
import ShiftSession from "../../models/ShiftSession";
import ShiftTemplate from "../../models/shiftTemplate.model";
import MonitoringSession from "../../models/MonitoringSession";
import User from "../../models/User";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 20_000;
// The free tier allows only a handful of requests per minute, so successive
// generations are paced through a shared slot instead of firing in parallel.
const GEMINI_CALL_SPACING_MS = 6_500;
// Bounds the automatic backfill sweep so a cold start cannot flood the quota.
const SWEEP_LOOKBACK_DAYS = 7;
const SWEEP_MAX_SHIFTS = 150;
const MAX_HOURLY_POINTS = 24;
const MAX_PIE_SEGMENTS = 6;
const PDF_CAPTURE_COUNT = 6;

type Requester = { userId: string; role: string };

type ShiftAnalysisContext = {
  shift: any;
  worker: { _id: string; name: string; email: string } | null;
  templateName: string;
  metrics: IAnalysisMetrics;
};

const clampScore = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const clampCount = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toDayKey = (date?: Date | string) => {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Access control — mirrors monitoring.service: admins see everyone, supervisors
// only the agents allocated to them.
// ---------------------------------------------------------------------------
const assertCanViewWorker = async (requester: Requester, targetUserId: string) => {
  if (requester.role === "admin") return;

  const supervisor = await User.findById(requester.userId).select("assignedAgentIds");
  const assigned = (supervisor?.assignedAgentIds || []).map((id: any) => String(id));

  if (!assigned.includes(String(targetUserId))) {
    throw new Error("You are not allowed to view this agent's analysis");
  }
};

const assignedAgentIdsFor = async (requester: Requester) => {
  if (requester.role !== "supervisor") return null;
  const supervisor = await User.findById(requester.userId).select("assignedAgentIds");
  return (supervisor?.assignedAgentIds || []).map((id: any) => String(id));
};

// ---------------------------------------------------------------------------
// Metric collection
// ---------------------------------------------------------------------------
const buildHourlyActivity = (mouseSamples: any[]) => {
  const buckets = new Map<string, number>();

  for (const sample of mouseSamples || []) {
    const movements = sample.movements || 0;
    const clicks = sample.clicks || 0;
    const scrolls = sample.scrolls || 0;
    // Samples are one-minute buckets; a sample with any interaction counts as
    // an active minute.
    if (movements <= 0 && clicks <= 0 && scrolls <= 0) continue;

    const hour = new Date(sample.at).toISOString().slice(11, 13);
    const label = `${hour}:00`;
    buckets.set(label, (buckets.get(label) || 0) + 1);
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(0, MAX_HOURLY_POINTS)
    .map(([hour, activeMinutes]) => ({ hour, activeMinutes }));
};

const collectShiftAnalysisContext = async (shift: any): Promise<ShiftAnalysisContext> => {
  const [events, monitoring, template, worker] = await Promise.all([
    ShiftEvent.find({ shiftId: shift._id }).sort({ timestamp: 1 }).lean(),
    MonitoringSession.findOne({ shiftSessionId: shift._id }).lean(),
    shift.shiftTemplateId
      ? ShiftTemplate.findById(shift.shiftTemplateId).select("name").lean()
      : Promise.resolve(null),
    User.findById(shift.userId).select("_id name email").lean(),
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

  return {
    shift,
    worker: worker
      ? { _id: String(worker._id), name: worker.name, email: worker.email }
      : null,
    templateName: template?.name || "Unassigned shift",
    metrics,
  };
};

// ---------------------------------------------------------------------------
// Deterministic charts — used as the fallback and as suggested chart data for
// the Gemini prompt.
// ---------------------------------------------------------------------------
const deterministicBarChart = (metrics: IAnalysisMetrics) => {
  const hourly = metrics.monitoring.hourlyActivity;

  if (hourly.length) {
    return {
      title: "Active minutes per hour",
      unit: "min",
      series: hourly.map((bucket) => ({ label: bucket.hour, value: bucket.activeMinutes })),
    };
  }

  return {
    title: "Time allocation",
    unit: "min",
    series: [
      { label: "Worked", value: metrics.workedMinutes },
      { label: "Breaks", value: metrics.breakMinutes },
      { label: "Overtime", value: metrics.overtimeMinutes },
    ].filter((point) => point.value > 0),
  };
};

const deterministicPieChart = (metrics: IAnalysisMetrics) => {
  const segments = [
    { label: "Worked", value: metrics.workedMinutes },
    { label: "Breaks", value: metrics.breakMinutes },
    { label: "Overtime", value: metrics.overtimeMinutes },
    { label: "Missed time", value: Math.max(0, metrics.scheduledMinutes - metrics.workedMinutes - metrics.breakMinutes) },
  ].filter((segment) => segment.value > 0);

  return {
    title: "Shift time allocation",
    unit: "min",
    segments: segments.length ? segments : [{ label: "No recorded time", value: 1 }],
  };
};

// ---------------------------------------------------------------------------
// Deterministic narrative — used for absent shifts, when no GEMINI_API_KEY is
// configured, or whenever the Gemini call fails.
// ---------------------------------------------------------------------------
const scoreBandFor = (score: number) => {
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 70) return "steady";
  if (score >= 55) return "mixed";
  return "below expectations";
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const buildFallbackAnalysis = (context: ShiftAnalysisContext, overallScore: number) => {
  const { metrics, worker, templateName } = context;
  const name = worker?.name || "The worker";
  const band = scoreBandFor(overallScore);
  const absent = metrics.attendanceStatus === "absent";

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (absent) {
    concerns.push(`${name} did not clock in for the scheduled ${formatDuration(metrics.scheduledMinutes)} shift.`);
  } else {
    if (overallScore >= 80) highlights.push(`Overall performance score of ${overallScore}% (${band}).`);
    if (metrics.lateMinutes > 0) concerns.push(`Clock-in was ${metrics.lateMinutes} minute(s) late.`);
    else if (!absent) highlights.push("Clocked in on time.");
    if (metrics.workScore >= 85) highlights.push(`Completed ${formatDuration(metrics.workedMinutes)} of the scheduled ${formatDuration(metrics.scheduledMinutes)}.`);
    if (metrics.overtimeMinutes > 0) concerns.push(`Recorded ${metrics.overtimeMinutes} minute(s) of overtime.`);
    if (metrics.activityAdherenceScore < 70) concerns.push(`Activity adherence of ${metrics.activityAdherenceScore}% drifted from the scheduled plan.`);
    if (metrics.monitoring.activeSamplePercent >= 60) highlights.push(`Active mouse engagement on ${metrics.monitoring.activeSamplePercent}% of tracked minutes.`);
    if (metrics.monitoring.captureCount > 0) highlights.push(`${metrics.monitoring.captureCount} periodic screenshot(s) captured during the shift.`);
  }

  const workerSummary = absent
    ? `${name} was recorded as absent for "${templateName}". No work, break, or monitoring activity was captured, so the shift scores 0%. This shift requires follow-up with the worker or their hiring manager.`
    : `${name} concluded "${templateName}" with an overall performance score of ${overallScore}% — ${band}. They recorded ${formatDuration(metrics.workedMinutes)} of work against ${formatDuration(metrics.scheduledMinutes)} scheduled${metrics.breakMinutes ? `, plus ${formatDuration(metrics.breakMinutes)} of breaks` : ""}. Punctuality scored ${metrics.punctualityScore}%, schedule adherence ${metrics.activityAdherenceScore}%, and time-on-task ${metrics.workScore}%.`;

  const workSummary = absent
    ? `The shift window passed with no clock-in and no monitoring session. The scheduled time of ${formatDuration(metrics.scheduledMinutes)} was fully missed.`
    : `The session generated ${metrics.monitoring.mouseMovements.toLocaleString()} mouse movements across ${metrics.monitoring.mouseDistancePx.toLocaleString()}px, ${metrics.monitoring.mouseClicks} click(s) and ${metrics.monitoring.mouseScrolls} scroll action(s), with screenshots captured every 15 minutes (${metrics.monitoring.captureCount} total). Closure reason: ${metrics.closureReason === "auto_closed" ? "the session was closed automatically after the maximum active duration" : metrics.closureReason === "missed_shift" ? "the shift was missed" : "normal clock-out"}.`;

  return {
    headline: absent
      ? `Absent shift — no work recorded (${formatDuration(metrics.scheduledMinutes)} scheduled)`
      : `${band.charAt(0).toUpperCase()}${band.slice(1)} shift — ${overallScore}% overall performance`,
    workerSummary,
    workSummary,
    highlights: highlights.slice(0, 4),
    concerns: concerns.slice(0, 4),
  };
};

// ---------------------------------------------------------------------------
// Gemini call — raw REST, mirroring the avs-frontend chat route (free-tier
// friendly, no SDK).
// ---------------------------------------------------------------------------
const nextGeminiSlot = (() => {
  let nextSlot = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + GEMINI_CALL_SPACING_MS;
    if (wait > 0) await sleep(wait);
  };
})();

const ANALYSIS_RESPONSE_CONTRACT = `{
  "headline": "one short sentence (max 90 chars) summarising the shift",
  "workerSummary": "2-4 sentence narration about the worker's performance",
  "workSummary": "2-4 sentence narration about the work done and session activity",
  "highlights": ["2-4 short positive observations"],
  "concerns": ["0-3 short issues to watch (empty array if none)"],
  "barChart": { "title": "chart title", "unit": "min", "series": [{ "label": "09:00", "value": 42 }] },
  "pieChart": { "title": "chart title", "unit": "min", "segments": [{ "label": "Worked", "value": 420 }] }
}`;

const buildGeminiPayload = (context: ShiftAnalysisContext, overallScore: number) => {
  const { metrics, worker, templateName } = context;
  const suggestedCharts = {
    barChart: deterministicBarChart(metrics),
    pieChart: deterministicPieChart(metrics),
  };

  const systemPrompt = [
    "You are a workforce analytics analyst for ShiftSync by Advanced Virtual Solutions.",
    "You turn structured shift telemetry into concise, professional, factual performance narratives for hiring managers.",
    "Use only the numbers provided; never invent metrics. Scores are percentages from 0 to 100.",
    "Durations are in minutes. The overall performance score is computed by the platform's weighted formula and is authoritative — narrate it, do not recalculate it.",
    "For the charts, showcase volume: prefer the suggested chart data, adjusting labels or titles only when it improves clarity.",
    `Respond with strict JSON only, exactly matching this contract: ${ANALYSIS_RESPONSE_CONTRACT}`,
  ].join(" ");

  const userPrompt = JSON.stringify({
    worker: worker ? { name: worker.name } : { name: "Unknown worker" },
    shift: {
      date: toDayKey(context.shift.scheduledStartTime || context.shift.clockInTime),
      template: templateName,
      scheduleType: metrics.scheduleType,
      attendanceStatus: metrics.attendanceStatus,
      closureReason: metrics.closureReason,
      scheduledMinutes: metrics.scheduledMinutes,
      workedMinutes: metrics.workedMinutes,
      breakMinutes: metrics.breakMinutes,
      lateMinutes: metrics.lateMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      overallPerformanceScore: overallScore,
      adherenceScore: metrics.activityAdherenceScore,
      punctualityScore: metrics.punctualityScore,
      workScore: metrics.workScore,
    },
    monitoredActivity: {
      screenshotsCaptured: metrics.monitoring.captureCount,
      mouseMovements: metrics.monitoring.mouseMovements,
      mouseDistancePx: metrics.monitoring.mouseDistancePx,
      mouseClicks: metrics.monitoring.mouseClicks,
      mouseScrolls: metrics.monitoring.mouseScrolls,
      trackedMinutes: metrics.monitoring.mouseSampleCount,
      activeMinutesPercent: metrics.monitoring.activeSamplePercent,
      activeMinutesPerHour: metrics.monitoring.hourlyActivity,
    },
    sessionEventCounts: metrics.eventCounts,
    suggestedCharts,
  });

  return { systemPrompt, userPrompt };
};

const callGemini = async (context: ShiftAnalysisContext, overallScore: number) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  await nextGeminiSlot();

  const { systemPrompt, userPrompt } = buildGeminiPayload(context, overallScore);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1400,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error ${response.status}`);
    }

    const data: any = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part: any) => part?.text || "")
      .join("")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    if (!text) throw new Error("Gemini returned an empty response");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
};

// ---------------------------------------------------------------------------
// Sanitising — Gemini output is untrusted; clamp everything before persisting.
// ---------------------------------------------------------------------------
const sanitizeText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const sanitizeTextList = (value: unknown, maxItems: number) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeText(item, 240))
    .filter(Boolean)
    .slice(0, maxItems);
};

const sanitizeChartPoints = (value: unknown, maxPoints: number): IAnalysisChartPoint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((point: any) => ({
      label: sanitizeText(point?.label, 40),
      value: Math.max(0, Math.round((Number(point?.value) || 0) * 100) / 100),
    }))
    .filter((point) => point.label)
    .slice(0, maxPoints);
};

const sanitizeGeminiResult = (raw: any, metrics: IAnalysisMetrics) => {
  const barSeries = sanitizeChartPoints(raw?.barChart?.series, MAX_HOURLY_POINTS);
  const pieSegments = sanitizeChartPoints(raw?.pieChart?.segments, MAX_PIE_SEGMENTS);
  const positivePieSegments = pieSegments.filter((segment) => segment.value > 0);

  return {
    narrative: {
      headline: sanitizeText(raw?.headline, 140),
      workerSummary: sanitizeText(raw?.workerSummary, 1200),
      workSummary: sanitizeText(raw?.workSummary, 1200),
      highlights: sanitizeTextList(raw?.highlights, 4),
      concerns: sanitizeTextList(raw?.concerns, 4),
    },
    charts: {
      bar: barSeries.length >= 2
        ? {
            title: sanitizeText(raw?.barChart?.title, 80) || "Activity volume",
            unit: sanitizeText(raw?.barChart?.unit, 12) || "min",
            series: barSeries,
          }
        : deterministicBarChart(metrics),
      pie: positivePieSegments.length >= 2
        ? {
            title: sanitizeText(raw?.pieChart?.title, 80) || "Shift volume mix",
            unit: sanitizeText(raw?.pieChart?.unit, 12) || "min",
            segments: positivePieSegments,
          }
        : deterministicPieChart(metrics),
    },
  };
};

// ---------------------------------------------------------------------------
// Generation + queueing
// ---------------------------------------------------------------------------
export const generateShiftAnalysis = async (
  shiftId: string,
  options: { force?: boolean; requester?: Requester } = {}
): Promise<IShiftAnalysis> => {
  const shift = await ShiftSession.findById(shiftId).lean();
  if (!shift) throw new Error("Shift not found");
  if (!["completed", "expired"].includes(shift.status)) {
    throw new Error("Analysis is only available for concluded shifts");
  }
  if (options.requester) {
    await assertCanViewWorker(options.requester, String(shift.userId));
  }

  const existing = await ShiftAnalysis.findOne({ shiftSessionId: shift._id });
  if (existing && !options.force) return existing;

  const context = await collectShiftAnalysisContext(shift);
  const overallScore = clampScore(shift.kpiScore);
  const adherenceScore = clampScore(shift.adherenceScore);

  let analysis: {
    status: "completed" | "failed";
    source: "gemini" | "fallback";
    aiModel: string;
    error?: string;
    narrative: ReturnType<typeof buildFallbackAnalysis>;
    charts: ReturnType<typeof sanitizeGeminiResult>["charts"];
  };

  if (context.metrics.attendanceStatus === "absent") {
    // Absent shifts carry no telemetry worth an AI call — narrate them locally.
    analysis = {
      status: "completed",
      source: "fallback",
      aiModel: "",
      narrative: buildFallbackAnalysis(context, 0),
      charts: {
        bar: deterministicBarChart(context.metrics),
        pie: deterministicPieChart(context.metrics),
      },
    };
  } else {
    try {
      const raw = await callGemini(context, overallScore);
      const sanitized = sanitizeGeminiResult(raw, context.metrics);
      analysis = {
        status: "completed",
        source: "gemini",
        aiModel: GEMINI_MODEL,
        narrative: sanitized.narrative.headline ||
          sanitized.narrative.workerSummary ||
          sanitized.narrative.workSummary
          ? sanitized.narrative
          : buildFallbackAnalysis(context, overallScore),
        charts: sanitized.charts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Gemini failure";
      console.error("Gemini shift analysis failed, using offline summary", message);
      analysis = {
        status: "completed",
        source: "fallback",
        aiModel: GEMINI_MODEL,
        error: message,
        narrative: buildFallbackAnalysis(context, overallScore),
        charts: {
          bar: deterministicBarChart(context.metrics),
          pie: deterministicPieChart(context.metrics),
        },
      };
    }
  }

  return ShiftAnalysis.findOneAndUpdate(
    { shiftSessionId: shift._id },
    {
      userId: String(shift.userId),
      workDate: toDayKey(shift.scheduledStartTime || shift.clockInTime),
      status: analysis.status,
      source: analysis.source,
      aiModel: analysis.aiModel,
      overallScore,
      adherenceScore,
      metrics: context.metrics,
      narrative: analysis.narrative,
      charts: analysis.charts,
      generatedAt: new Date(),
      error: analysis.error || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const queuedShiftIds = new Set<string>();
let analysisQueue: Promise<void> = Promise.resolve();

// Fire-and-forget entry point for shift-conclusion hooks: generations run
// sequentially (never in parallel) so the free-tier quota is respected.
export const enqueueShiftAnalysis = (shiftId: string, force = false) => {
  const key = `${shiftId}:${force ? "force" : "auto"}`;
  if (queuedShiftIds.has(key)) return;

  queuedShiftIds.add(key);
  analysisQueue = analysisQueue
    .then(async () => {
      await generateShiftAnalysis(shiftId, { force });
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
      enqueueShiftAnalysis(id);
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
            source: analysis.source as string,
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

  return ShiftAnalysis.findOne({ shiftSessionId: shift._id });
};

export const getAnalysisOverview = async (requester: Requester) => {
  const assignedAgentIds = await assignedAgentIdsFor(requester);
  const userFilter = assignedAgentIds ? { userId: { $in: assignedAgentIds } } : {};

  const [totalAnalyses, avgResult, geminiCount, recentAnalyses] = await Promise.all([
    ShiftAnalysis.countDocuments({ ...userFilter, status: "completed" }),
    ShiftAnalysis.aggregate([
      { $match: { ...userFilter, status: "completed" } },
      { $group: { _id: null, average: { $avg: "$overallScore" } } },
    ]),
    ShiftAnalysis.countDocuments({ ...userFilter, status: "completed", source: "gemini" }),
    ShiftAnalysis.countDocuments({
      ...userFilter,
      status: "completed",
      generatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    totalAnalyses,
    averageScore: avgResult.length ? clampScore(avgResult[0].average) : 0,
    geminiAnalyses: geminiCount,
    recentAnalyses,
  };
};
