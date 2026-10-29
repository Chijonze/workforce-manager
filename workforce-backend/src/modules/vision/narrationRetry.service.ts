import ActivityNarration from "../../models/ActivityNarration";
import MonitoringSession from "../../models/MonitoringSession";
import ShiftAnalysis from "../../models/ShiftAnalysis";
import ShiftSession from "../../models/ShiftSession";
import { generateShiftAnalysis } from "../analysis/analysis.service";
import { consumeDailyAttempt, isQuotaBlocked } from "../ai/quota.service";
import { generateActivityNarration } from "./activityNarration.service";
import { visionConfig } from "./vision.config";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Concluded shifts in the lookback window whose screenshots are not yet fully
 * narrated. A narration only counts as done when it covers every capture on the
 * session — the same invariant `generateActivityNarration` uses to bypass its
 * cache.
 */
export const findShiftsNeedingNarration = async (): Promise<string[]> => {
  const since = new Date(Date.now() - visionConfig.retryLookbackDays * DAY_MS);

  const sessions = await MonitoringSession.find({
    startedAt: { $gte: since },
    "captures.0": { $exists: true },
  })
    .select("shiftSessionId captures")
    .sort({ startedAt: -1 })
    .limit(120)
    .lean();

  if (!sessions.length) return [];

  const shiftIds = sessions.map((session: any) => session.shiftSessionId);
  const [shifts, narrations] = await Promise.all([
    ShiftSession.find({
      _id: { $in: shiftIds },
      status: { $in: ["completed", "expired"] },
      attendanceStatus: { $ne: "absent" },
    })
      .select("_id")
      .lean(),
    ActivityNarration.find({ shiftSessionId: { $in: shiftIds } })
      .select("shiftSessionId status coverage.captures")
      .lean(),
  ]);

  const eligible = new Set(shifts.map((shift: any) => String(shift._id)));
  const narrationByShift = new Map(
    narrations.map((narration: any) => [String(narration.shiftSessionId), narration])
  );

  const pending: string[] = [];
  for (const session of sessions as any[]) {
    const id = String(session.shiftSessionId);
    if (!eligible.has(id)) continue;

    const captureCount = session.captures?.length || 0;
    const narration = narrationByShift.get(id);
    const covered = (narration?.coverage?.captures || 0) >= captureCount;

    if (narration?.status === "completed" && covered) continue;
    pending.push(id);
  }

  return pending;
};

export const countPendingNarrations = async () => (await findShiftsNeedingNarration()).length;

export type RetrySweepResult = {
  ran: boolean;
  reason?: string;
  shiftId?: string;
  status?: string;
  blocks?: number;
  remaining?: number;
};

/**
 * Runs at most `VISON_RETRY_MAX_SHIFTS_PER_DAY` shifts per day, and never while
 * the daily quota is exhausted. When the 429 reset time passes this resumes on
 * its own and upgrades any report that had fallen back to the offline summary.
 */
export const runNarrationRetrySweep = async (): Promise<RetrySweepResult> => {
  if (!visionConfig.retryEnabled) return { ran: false, reason: "disabled" };

  const quota = await isQuotaBlocked();
  if (quota.blocked) {
    return { ran: false, reason: `quota blocked until ${quota.until?.toISOString()}` };
  }

  const pending = await findShiftsNeedingNarration();
  if (!pending.length) return { ran: false, reason: "nothing pending" };

  const budget = await consumeDailyAttempt(visionConfig.retryMaxShiftsPerDay);
  if (!budget.allowed) {
    return {
      ran: false,
      reason: `daily budget used (${budget.used}/${budget.limit}); ${pending.length} still pending`,
    };
  }

  const shiftId = pending[0];
  const narration = await generateActivityNarration(shiftId);

  // Upgrade the report too: either it fell back to the offline narrative, or it
  // predates screen evidence and therefore has no screenActivity at all.
  const analysis = await ShiftAnalysis.findOne({ shiftSessionId: shiftId })
    .select("source screenActivity")
    .lean();
  if (!analysis || !analysis.screenActivity || analysis.source === "fallback") {
    await generateShiftAnalysis(shiftId, { force: true, narrate: false });
  }

  return {
    ran: true,
    shiftId,
    status: narration.status,
    blocks: narration.blocks.length,
    remaining: pending.length - 1,
  };
};

export const retryState = () => ({
  enabled: visionConfig.retryEnabled,
  intervalMs: visionConfig.retryIntervalMs,
  maxShiftsPerDay: visionConfig.retryMaxShiftsPerDay,
  lookbackDays: visionConfig.retryLookbackDays,
});
