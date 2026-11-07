import type { IAnalysisDerived, IAnalysisMetrics } from "../../models/ShiftAnalysis";
import type { ShiftScreenBlock } from "./analysis.types";

const MAX_HOURLY_POINTS = 24;

export const clampScore = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
};

export const clampCount = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
};

export const formatDuration = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export const toDayKey = (date?: Date | string) => {
  if (!date) return new Date().toISOString().slice(0, 10);
  return new Date(date).toISOString().slice(0, 10);
};

/** Samples are one-minute buckets; a sample with any interaction is active. */
export const buildHourlyActivity = (mouseSamples: any[]) => {
  const buckets = new Map<string, number>();

  for (const sample of mouseSamples || []) {
    const movements = sample.movements || 0;
    const clicks = sample.clicks || 0;
    const scrolls = sample.scrolls || 0;
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

const hourOf = (label: string) => Number(String(label).slice(0, 2)) || 0;

const topCounts = (values: string[], limit: number) => {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = String(raw || "").trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([name]) => name);
};

const longestGap = (hourly: { hour: string; activeMinutes: number }[]) => {
  const active = hourly.filter((bucket) => bucket.activeMinutes > 0).sort((a, b) => hourOf(a.hour) - hourOf(b.hour));
  let longest = 0;
  let window = "";

  for (let index = 1; index < active.length; index += 1) {
    const gapMinutes = (hourOf(active[index].hour) - hourOf(active[index - 1].hour)) * 60;
    if (gapMinutes > longest) {
      longest = gapMinutes;
      window = `${active[index - 1].hour}–${active[index].hour}`;
    }
  }

  return { minutes: longest, window };
};

/**
 * Everything the report quotes is computed here, once. The language model only
 * narrates these figures, so two paragraphs can never disagree about the same
 * metric.
 */
export const deriveShiftMetrics = (
  metrics: IAnalysisMetrics,
  screenBlocks: ShiftScreenBlock[]
): IAnalysisDerived => {
  const hourly = metrics.monitoring.hourlyActivity || [];
  const trackedMinutes = clampCount(metrics.monitoring.mouseSampleCount);
  const activeMinutes = Math.min(
    trackedMinutes,
    Math.round((trackedMinutes * clampScore(metrics.monitoring.activeSamplePercent)) / 100)
  );
  const activeHours = activeMinutes / 60;
  const peak = [...hourly].sort((left, right) => right.activeMinutes - left.activeMinutes)[0];
  const activeBuckets = hourly.filter((bucket) => bucket.activeMinutes > 0);
  const quietest = activeBuckets.length
    ? [...activeBuckets].sort((left, right) => left.activeMinutes - right.activeMinutes)[0]
    : undefined;
  const spanHours = hourly.length
    ? Math.max(...hourly.map((bucket) => hourOf(bucket.hour))) -
      Math.min(...hourly.map((bucket) => hourOf(bucket.hour))) +
      1
    : 0;
  const gap = longestGap(hourly);
  const perActiveHour = (value: number) =>
    activeHours > 0 ? Math.round(value / activeHours) : 0;

  return {
    timeUtilisationPercent: metrics.scheduledMinutes
      ? Math.round((metrics.workedMinutes / metrics.scheduledMinutes) * 100)
      : 0,
    breakSharePercent: metrics.scheduledMinutes
      ? Math.round((metrics.breakMinutes / metrics.scheduledMinutes) * 100)
      : 0,
    overtimeSharePercent: metrics.scheduledMinutes
      ? Math.round((metrics.overtimeMinutes / metrics.scheduledMinutes) * 100)
      : 0,
    idleMinutes: Math.max(
      0,
      metrics.scheduledMinutes - metrics.workedMinutes - metrics.breakMinutes
    ),
    trackedMinutes,
    activeMinutes,
    activeToWorkedPercent: metrics.workedMinutes
      ? clampScore((activeMinutes / metrics.workedMinutes) * 100)
      : 0,
    movementsPerActiveHour: perActiveHour(metrics.monitoring.mouseMovements),
    clicksPerActiveHour: perActiveHour(metrics.monitoring.mouseClicks),
    scrollsPerActiveHour: perActiveHour(metrics.monitoring.mouseScrolls),
    peakHour: peak?.hour || "",
    quietestHour: quietest?.hour || "",
    activeHourCount: activeBuckets.length,
    observedSpanHours: spanHours,
    longestGapMinutes: gap.minutes,
    longestGapWindow: gap.window,
    screenBlocks: screenBlocks.length,
    focusedBlocks: screenBlocks.filter((block) => block.activity === "focused").length,
    mixedBlocks: screenBlocks.filter((block) => block.activity === "mixed").length,
    idleBlocks: screenBlocks.filter((block) => block.activity === "idle").length,
    averageScreenConfidence: screenBlocks.length
      ? Math.round(
          screenBlocks.reduce((sum, block) => sum + (block.confidence || 0), 0) / screenBlocks.length
        )
      : 0,
    topApps: topCounts(screenBlocks.flatMap((block) => block.apps || []), 6),
    topTasks: topCounts(screenBlocks.flatMap((block) => block.tasks || []), 8),
  };
};

export const scoreBandFor = (score: number) => {
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 70) return "steady";
  if (score >= 55) return "mixed";
  return "below expectations";
};

export const closureLabel = (closureReason: string) =>
  closureReason === "auto_closed"
    ? "the session was closed automatically after the maximum active duration"
    : closureReason === "missed_shift"
      ? "the shift was marked missed without a clock-in"
      : "a routine clock-out";
