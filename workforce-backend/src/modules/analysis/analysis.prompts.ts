import type { IAnalysisMetrics } from "../../models/ShiftAnalysis";
import type { IPeriodWorkerNote, IPeriodSections } from "../../models/PeriodAnalysis";
import {
  closureLabel,
  formatDuration,
  scoreBandFor,
} from "./analysis.metrics";
import type {
  AggregateContext,
  AggregateWorkerRow,
  PeriodNarrative,
  ShiftAnalysisContext,
  ShiftNarrative,
  ShiftReportPayload,
} from "./analysis.types";
import type { IAnalysisRecommendation, IAnalysisSection, IAnalysisTimelineEntry } from "../../models/ShiftAnalysis";

const MAX_CHART_POINTS = 24;
const MAX_PIE_SEGMENTS = 6;

export const ANALYSIS_SECTION_ORDER = [
  "attendance",
  "time",
  "productivity",
  "screen",
  "risk",
  "coaching",
  "outlook",
] as const;

export const ANALYSIS_SECTION_TITLES: Record<(typeof ANALYSIS_SECTION_ORDER)[number], string> = {
  attendance: "Attendance & punctuality",
  time: "Time & schedule adherence",
  productivity: "Productivity & engagement",
  screen: "What the screenshots show",
  risk: "Risks & compliance",
  coaching: "Coaching plan",
  outlook: "Outlook",
};

export const PERIOD_SECTION_ORDER = [
  "performance",
  "attendance",
  "screenStory",
  "patterns",
  "risks",
  "recommendations",
  "outlook",
] as const;

export const PERIOD_SECTION_TITLES: Record<(typeof PERIOD_SECTION_ORDER)[number], string> = {
  performance: "Performance across the period",
  attendance: "Attendance, punctuality & time",
  screenStory: "The working story: what the screenshots recorded",
  patterns: "Working patterns & productivity signals",
  risks: "Risks, inconsistencies & compliance",
  recommendations: "Recommendations for the hiring manager",
  outlook: "Outlook for the next period",
};

// ---------------------------------------------------------------------------
// Shift report
// ---------------------------------------------------------------------------
const SHIFT_CONTRACT = `{
  "headline": "one sentence (max 110 chars) that captures the shift",
  "executiveSummary": "3-4 paragraphs separated by \\n\\n, 220-320 words, telling the story of the shift",
  "workerSummary": "3-5 sentences on attendance, punctuality and reliability (legacy field, still rendered)",
  "workSummary": "3-5 sentences on the work performed and session activity (legacy field, still rendered)",
  "sections": {
    "attendance": "130-200 words",
    "time": "130-200 words",
    "productivity": "150-220 words",
    "screen": "180-260 words of chronological storytelling from the screen evidence",
    "risk": "100-170 words",
    "coaching": "150-220 words",
    "outlook": "90-150 words"
  },
  "verdict": "2-4 sentences giving the hiring manager a clear conclusion",
  "highlights": ["4 to 8 specific positive observations, each under 200 chars"],
  "concerns": ["2 to 6 specific risks or gaps, each under 200 chars (empty array if genuinely none)"],
  "timeline": [{"time": "09:00-10:15", "title": "short label", "detail": "1-2 sentences of what happened"}],
  "recommendations": [{"title": "short action", "detail": "1-2 sentences", "priority": "high" | "medium" | "low"}],
  "barChart": { "title": "chart title", "unit": "min", "series": [{ "label": "09:00", "value": 42 }] },
  "pieChart": { "title": "chart title", "unit": "min", "segments": [{ "label": "Worked", "value": 420 }] }
}`;

const SHIFT_SYSTEM_PROMPT = [
  "You are a senior workforce analyst at ShiftSync by Advanced Virtual Solutions.",
  "You write long-form, evidence-led shift performance reports for hiring managers who make staffing and renewal decisions from them.",
  "You are given complete telemetry for one concluded shift: scheduled and worked time, breaks, lateness, overtime, KPI scores, mouse activity per hour, monitoring session events, and a per-window narration of the worker's screen captured from periodic screenshots.",
  "Write in British English, in the past tense, in the third person. Address the hiring manager as the reader.",
  "Length and depth: the report must be substantial. The executive summary is 3-4 paragraphs, each section is 2-4 paragraphs, and the whole report should read as 1,200-1,800 words. Never pad with repetition; use the evidence you were given.",
  "Hard rules:",
  "1. Use only the numbers supplied. Never invent metrics, times, applications, tasks or outcomes. Scores are percentages from 0 to 100; durations are minutes unless stated otherwise. The overall score is authoritative — narrate it, do not recalculate it.",
  "2. The screen evidence is a sample, not continuous surveillance. Describe what was observed in the windows provided, and say plainly when a window was quiet rather than inferring idleness or misconduct.",
  "3. Name the applications, documents and task types that appear in the screen evidence when describing the work. Quote the time windows.",
  "4. Never reproduce personal data — customer names, email addresses, phone numbers, card numbers or addresses — even if it appears in the evidence. Refer to such records generically.",
  "5. Be fair and specific. Explain the significance of each number rather than repeating it. Where a metric is missing, say so instead of guessing.",
  "6. Never mention which model or vendor produced this report, and never refer to yourself as an AI. It is the company's analysis.",
  "7. Do not use markdown, headings, bullet characters or tables inside the prose fields. Plain sentences only. The array fields are the only lists.",
  "8. If the worker was absent, write the report around missed attendance and its operational impact; do not invent any work.",
  "9. Avoid vague filler such as 'overall it was a good shift'. Every paragraph should add a fact, an interpretation or an action.",
  `Respond with strict JSON only, exactly matching this contract: ${SHIFT_CONTRACT}`,
].join(" ");

const shiftChartData = (metrics: IAnalysisMetrics) => {
  const hourly = metrics.monitoring.hourlyActivity || [];
  const bar = hourly.length
    ? {
        title: "Active minutes per hour",
        unit: "min",
        series: hourly.map((bucket) => ({ label: bucket.hour, value: bucket.activeMinutes })),
      }
    : {
        title: "Time allocation",
        unit: "min",
        series: [
          { label: "Worked", value: metrics.workedMinutes },
          { label: "Breaks", value: metrics.breakMinutes },
          { label: "Overtime", value: metrics.overtimeMinutes },
        ].filter((point) => point.value > 0),
      };

  const segments = [
    { label: "Worked", value: metrics.workedMinutes },
    { label: "Breaks", value: metrics.breakMinutes },
    { label: "Overtime", value: metrics.overtimeMinutes },
    {
      label: "Missed time",
      value: Math.max(0, metrics.scheduledMinutes - metrics.workedMinutes - metrics.breakMinutes),
    },
  ].filter((segment) => segment.value > 0);

  return {
    bar,
    pie: {
      title: "Shift time allocation",
      unit: "min",
      segments: segments.length ? segments : [{ label: "No recorded time", value: 1 }],
    },
  };
};

export const deterministicShiftCharts = shiftChartData;

export const buildShiftPrompt = (context: ShiftAnalysisContext, overallScore: number) => {
  const { metrics, derived, worker, templateName, screen } = context;
  const name = worker?.name || "The worker";
  const absent = metrics.attendanceStatus === "absent";

  const systemPrompt = SHIFT_SYSTEM_PROMPT;

  const userPrompt = JSON.stringify({
    reportFor: "Hiring manager",
    worker: { name },
    shift: {
      date: context.shift.workDateKey,
      template: templateName,
      scheduleType: metrics.scheduleType,
      attendanceStatus: metrics.attendanceStatus,
      closureReason: metrics.closureReason,
      closureMeaning: closureLabel(metrics.closureReason),
      scheduledMinutes: metrics.scheduledMinutes,
      workedMinutes: metrics.workedMinutes,
      breakMinutes: metrics.breakMinutes,
      lateMinutes: metrics.lateMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      overallPerformanceScore: overallScore,
      adherenceScore: metrics.activityAdherenceScore,
      punctualityScore: metrics.punctualityScore,
      workScore: metrics.workScore,
      absent,
    },
    measuredBehaviour: {
      timeUtilisationPercent: derived.timeUtilisationPercent,
      breakSharePercent: derived.breakSharePercent,
      overtimeSharePercent: derived.overtimeSharePercent,
      unaccountedScheduledMinutes: derived.idleMinutes,
      trackedMinutes: derived.trackedMinutes,
      activeMinutes: derived.activeMinutes,
      activeToWorkedPercent: derived.activeToWorkedPercent,
      activeHourCount: derived.activeHourCount,
      observedSpanHours: derived.observedSpanHours,
      peakActiveHour: derived.peakHour,
      quietestActiveHour: derived.quietestHour,
      longestInactiveGapMinutes: derived.longestGapMinutes,
      longestInactiveGapWindow: derived.longestGapWindow,
      movementsPerActiveHour: derived.movementsPerActiveHour,
      clicksPerActiveHour: derived.clicksPerActiveHour,
      scrollsPerActiveHour: derived.scrollsPerActiveHour,
      mouseMovements: metrics.monitoring.mouseMovements,
      mouseDistancePx: metrics.monitoring.mouseDistancePx,
      mouseClicks: metrics.monitoring.mouseClicks,
      mouseScrolls: metrics.monitoring.mouseScrolls,
      activeMinutesPercent: metrics.monitoring.activeSamplePercent,
      activeMinutesPerHour: metrics.monitoring.hourlyActivity,
    },
    screenEvidence: {
      available: screen.blocks.length > 0,
      status: screen.status,
      overview: screen.overview,
      screenshotsCaptured: metrics.monitoring.captureCount,
      framesAnalysed: screen.coverage.uniqueFrames,
      windows: screen.blocks.map((block) => ({
        window: block.window,
        activity: block.activity,
        summary: block.summary,
        apps: block.apps,
        tasks: block.tasks,
        onScreenEvidence: block.evidence,
        concerns: block.concerns,
        confidence: block.confidence,
      })),
      dominantApplications: derived.topApps,
      recurringTasks: derived.topTasks,
      focusedWindows: derived.focusedBlocks,
      mixedWindows: derived.mixedBlocks,
      idleWindows: derived.idleBlocks,
      averageNarrationConfidence: derived.averageScreenConfidence,
    },
    sessionEventCounts: metrics.eventCounts,
    suggestedCharts: shiftChartData(metrics),
    note: screen.blocks.length
      ? "Screen evidence is available: use it for the 'screen' section and for concrete detail throughout."
      : "No screen narration is available for this shift. Say in the 'screen' section that no screen evidence was captured and do not speculate about what was on screen.",
  });

  return { systemPrompt, userPrompt };
};

// ---------------------------------------------------------------------------
// Sanitising — model output is untrusted; clamp everything before persisting.
// ---------------------------------------------------------------------------
const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.replace(/\r/g, "").trim().slice(0, maxLength) : "";

const textList = (value: unknown, maxItems: number, maxLength = 240) =>
  Array.isArray(value)
    ? value
        .map((item) => text(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const chartPoints = (value: unknown, maxPoints: number) =>
  Array.isArray(value)
    ? value
        .map((point: any) => ({
          label: text(point?.label, 40),
          value: Math.max(0, Math.round((Number(point?.value) || 0) * 100) / 100),
        }))
        .filter((point) => point.label)
        .slice(0, maxPoints)
    : [];

const sanitizeTimeline = (value: unknown, maxItems: number): IAnalysisTimelineEntry[] =>
  Array.isArray(value)
    ? value
        .map((entry: any) => ({
          time: text(entry?.time, 40),
          title: text(entry?.title, 140),
          detail: text(entry?.detail, 700),
        }))
        .filter((entry) => entry.title || entry.detail)
        .slice(0, maxItems)
    : [];

const sanitizeRecommendations = (value: unknown, maxItems: number): IAnalysisRecommendation[] =>
  Array.isArray(value)
    ? value
        .map((entry: any) => {
          const priority = String(entry?.priority || "").toLowerCase();
          return {
            title: text(entry?.title, 160),
            detail: text(entry?.detail, 700),
            priority: (priority === "high" || priority === "low" ? priority : "medium") as
              | "high"
              | "medium"
              | "low",
          };
        })
        .filter((entry) => entry.title || entry.detail)
        .slice(0, maxItems)
    : [];

export const sanitizeShiftReport = (
  raw: any,
  metrics: IAnalysisMetrics,
  fallback: ShiftReportPayload
): { report: ShiftReportPayload; charts: { bar: any; pie: any } } => {
  const sectionsRaw = raw?.sections && typeof raw.sections === "object" ? raw.sections : {};
  const sections = {} as IAnalysisSection;
  for (const key of ANALYSIS_SECTION_ORDER) {
    sections[key] = text((sectionsRaw as any)[key], 2600) || fallback.narrative.sections[key];
  }

  const narrative: ShiftNarrative = {
    headline: text(raw?.headline, 200) || fallback.narrative.headline,
    executiveSummary: text(raw?.executiveSummary, 6500) || fallback.narrative.executiveSummary,
    workerSummary: text(raw?.workerSummary, 1800) || fallback.narrative.workerSummary,
    workSummary: text(raw?.workSummary, 1800) || fallback.narrative.workSummary,
    verdict: text(raw?.verdict, 1200) || fallback.narrative.verdict,
    highlights: textList(raw?.highlights, 8).length
      ? textList(raw?.highlights, 8)
      : fallback.narrative.highlights,
    concerns: Array.isArray(raw?.concerns)
      ? textList(raw.concerns, 6)
      : fallback.narrative.concerns,
    sections,
  };

  const timeline = sanitizeTimeline(raw?.timeline, 14);
  const recommendations = sanitizeRecommendations(raw?.recommendations, 8);

  const barSeries = chartPoints(raw?.barChart?.series, MAX_CHART_POINTS);
  const pieSegments = chartPoints(raw?.pieChart?.segments, MAX_PIE_SEGMENTS).filter(
    (segment) => segment.value > 0
  );
  const suggested = shiftChartData(metrics);

  return {
    report: {
      narrative,
      timeline: timeline.length ? timeline : fallback.timeline,
      recommendations: recommendations.length ? recommendations : fallback.recommendations,
    },
    charts: {
      bar:
        barSeries.length >= 2
          ? {
              title: text(raw?.barChart?.title, 90) || suggested.bar.title,
              unit: text(raw?.barChart?.unit, 12) || "min",
              series: barSeries,
            }
          : suggested.bar,
      pie:
        pieSegments.length >= 2
          ? {
              title: text(raw?.pieChart?.title, 90) || suggested.pie.title,
              unit: text(raw?.pieChart?.unit, 12) || "min",
              segments: pieSegments,
            }
          : suggested.pie,
    },
  };
};

// ---------------------------------------------------------------------------
// Deterministic shift report — used for absent shifts, missing configuration or
// a provider failure. It must still read as a complete report.
// ---------------------------------------------------------------------------
export const buildFallbackShiftReport = (
  context: ShiftAnalysisContext,
  overallScore: number
): ShiftReportPayload => {
  const { metrics, derived, worker, templateName, screen } = context;
  const name = worker?.name || "The worker";
  const band = scoreBandFor(overallScore);
  const absent = metrics.attendanceStatus === "absent";
  const observedApps = derived.topApps.length ? derived.topApps : [];
  const screenLead = screen.overview?.trim();

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (absent) {
    concerns.push(
      `${name} did not clock in for the scheduled ${formatDuration(metrics.scheduledMinutes)} shift.`
    );
  } else {
    if (overallScore >= 80) highlights.push(`Overall performance score of ${overallScore}% (${band}).`);
    if (metrics.lateMinutes > 0) concerns.push(`Clock-in was ${metrics.lateMinutes} minute(s) late.`);
    else if (!absent) highlights.push("Clocked in on time.");
    if (metrics.workScore >= 85)
      highlights.push(
        `Completed ${formatDuration(metrics.workedMinutes)} of the scheduled ${formatDuration(metrics.scheduledMinutes)}.`
      );
    if (metrics.overtimeMinutes > 0) concerns.push(`Recorded ${metrics.overtimeMinutes} minute(s) of overtime.`);
    if (metrics.activityAdherenceScore < 70)
      concerns.push(
        `Activity adherence of ${metrics.activityAdherenceScore}% drifted from the scheduled plan.`
      );
    if (metrics.monitoring.activeSamplePercent >= 60)
      highlights.push(
        `Active mouse engagement on ${metrics.monitoring.activeSamplePercent}% of tracked minutes.`
      );
    if (metrics.monitoring.captureCount > 0)
      highlights.push(`${metrics.monitoring.captureCount} periodic screenshot(s) captured during the shift.`);
    if (derived.longestGapMinutes >= 90)
      concerns.push(
        `The longest inactive window ran ${formatDuration(derived.longestGapMinutes)} (${derived.longestGapWindow}).`
      );
  }

  if (observedApps.length) {
    highlights.push(`Screen activity centred on ${observedApps.slice(0, 4).join(", ")}.`);
  }

  const timeLine = absent
    ? `No time was recorded for this shift. The scheduled ${formatDuration(metrics.scheduledMinutes)} window passed without a clock-in, and no monitoring session, break or activity data exists to review.`
    : `The shift was scheduled for ${formatDuration(metrics.scheduledMinutes)}. ${formatDuration(
        metrics.workedMinutes
      )} of work was recorded (${derived.timeUtilisationPercent}% utilisation)${
        metrics.breakMinutes ? `, with ${formatDuration(metrics.breakMinutes)} recorded as breaks (${derived.breakSharePercent}% of the schedule)` : ""
      }${metrics.overtimeMinutes ? `, and ${formatDuration(metrics.overtimeMinutes)} of overtime` : ""}. ${
        derived.idleMinutes > 0
          ? `${formatDuration(derived.idleMinutes)} of the scheduled window is unaccounted for.`
          : "Every scheduled minute is accounted for by work or recorded breaks."
      }`;

  const attendanceLine = absent
    ? `${name} was marked absent for "${templateName}". Attendance is the first control in this engagement: a missed shift leaves the client's queue uncovered and normally triggers a same-day conversation with the worker and their supervisor.`
    : `${name} attended this "${templateName}" shift ${
        metrics.lateMinutes > 0 ? `${metrics.lateMinutes} minute(s) late` : "on time"
      }, with a punctuality score of ${metrics.punctualityScore}% and a schedule adherence score of ${
        metrics.activityAdherenceScore
      }%. The session concluded through ${closureLabel(metrics.closureReason)}.`;

  const productivityLine = absent
    ? "There is no productivity evidence for an absent shift. The KPI engine returns 0% because no work, break or monitoring events were recorded; this is a data-completeness fact, not a judgement about capability."
    : `Across ${derived.trackedMinutes} tracked minutes the worker was active for ${derived.activeMinutes} minutes (${metrics.monitoring.activeSamplePercent}% of tracked time). Activity peaked at ${derived.peakHour || "no recorded hour"} and the quietest active hour was ${derived.quietestHour || "not established"}. The session produced ${metrics.monitoring.mouseMovements.toLocaleString("en-GB")} mouse movements over ${metrics.monitoring.mouseDistancePx.toLocaleString("en-GB")}px, ${metrics.monitoring.mouseClicks} clicks and ${metrics.monitoring.mouseScrolls} scroll actions. Active time covers ${derived.activeToWorkedPercent}% of recorded work time.`;

  const screenLine = absent
    ? "No screenshots exist for an absent shift. The screen section of this report is therefore closed rather than inferred."
    : screen.blocks.length
      ? `${screenLead || "Screen evidence was captured across the shift."} ${
          observedApps.length ? `The dominant applications were ${observedApps.slice(0, 5).join(", ")}.` : ""
        } ${
          derived.topTasks.length ? `Recurring tasks included ${derived.topTasks.slice(0, 5).join("; ")}.` : ""
        } Of the ${derived.screenBlocks} narrated windows, ${derived.focusedBlocks} read as focused work, ${derived.mixedBlocks} as mixed activity and ${derived.idleBlocks} as idle or blank.`
      : `No screen narration was produced for this shift, so this report cannot describe the applications or documents in use. The ${metrics.monitoring.captureCount} captured screenshot(s) are retained as evidence and can be reviewed manually.`;

  const riskLine = absent
    ? "The principal risk is coverage: an unattended shift exposes the client to missed service levels. Repeated absences should be escalated under the attendance policy."
    : `${metrics.lateMinutes > 0 ? `Lateness of ${metrics.lateMinutes} minute(s) is a repeat-attendance risk. ` : ""}${
        metrics.overtimeMinutes > 0
          ? `${formatDuration(metrics.overtimeMinutes)} of overtime suggests either scope creep or under-staffing and should be reviewed against the agreed schedule. `
          : ""
      }${
        metrics.activityAdherenceScore < 70
          ? `Adherence at ${metrics.activityAdherenceScore}% indicates the worker's day diverged materially from the planned schedule. `
          : ""
      }${
        derived.longestGapMinutes >= 90
          ? `A ${formatDuration(derived.longestGapMinutes)} inactive window (${derived.longestGapWindow}) should be checked against break records. `
          : ""
      }${
        (screen.blocks || []).some((block) => (block.concerns || []).length)
          ? "Screen evidence recorded one or more flags (for example credentials or non-work browsing); review those windows with the worker."
          : "No screen-level compliance flags were recorded in this shift."
      }`;

  const coachingActions = absent
    ? [
        "Confirm the reason for the absence and whether it was approved.",
        "Agree a make-up plan or coverage arrangement for the missed window.",
      ]
    : [
        metrics.lateMinutes > 0 ? "Agree a reliable start routine to remove recurring lateness." : "",
        metrics.activityAdherenceScore < 70
          ? "Review the scheduled plan with the worker and rebuild the day around the highest-value tasks."
          : "",
        derived.longestGapMinutes >= 90
          ? `Check the ${derived.longestGapWindow} gap against break policy and agree how long idle stretches are reported.`
          : "",
        observedApps.length ? `Keep ${observedApps[0]} as the primary working surface and reduce tool switching during focus blocks.` : "",
        "Share this report with the worker so the evidence and the score are transparent.",
      ].filter(Boolean);

  const outlookLine = absent
    ? "The next period should be judged on restored attendance. A single missed shift is recoverable; a pattern is not."
    : `With ${metrics.punctualityScore}% punctuality and ${metrics.workScore}% time-on-task, the next period should focus on ${
        metrics.activityAdherenceScore < 75 ? "schedule adherence" : "consistency at the current level"
      }. ${overallScore >= 80 ? "The trajectory supports continued assignment." : "Improvement in the two weakest scores would move this worker into the next band."}`;

  const executiveSummary = absent
    ? `${name} was scheduled for "${templateName}" on ${context.shift.workDateKey} for ${formatDuration(
        metrics.scheduledMinutes
      )} but did not clock in. No work, break or monitoring activity was captured, so the shift scores ${overallScore}%.\n\nThe operational consequence is coverage: the scheduled window passed with no recorded activity. This report records the absence, sets out the evidence position and recommends a same-day conversation with the worker and their supervisor.\n\nNo screen evidence exists for an absent shift, so nothing in this report infers what the worker was doing.`
    : `${name} worked "${templateName}" on ${context.shift.workDateKey}, recording ${formatDuration(
        metrics.workedMinutes
      )} against a scheduled ${formatDuration(metrics.scheduledMinutes)}. The shift scores ${overallScore}% overall (${band}), with ${metrics.punctualityScore}% punctuality, ${metrics.activityAdherenceScore}% schedule adherence and ${metrics.workScore}% time-on-task.\n\n${timeLine}\n\nOn the evidence available, the shift reads as ${band}. ${
        concerns.length
          ? `The points that need attention are ${concerns.length === 1 ? "set out" : "set out"} below; none of them invalidate the work recorded.`
          : "No material concerns were recorded."
      }`;

  const report: ShiftReportPayload = {
    narrative: {
      headline: absent
        ? `Absent shift — no work recorded (${formatDuration(metrics.scheduledMinutes)} scheduled)`
        : `${band.charAt(0).toUpperCase()}${band.slice(1)} shift — ${overallScore}% overall performance`,
      executiveSummary,
      workerSummary: absent
        ? `${name} did not attend the scheduled "${templateName}" shift. Attendance, punctuality and work scores therefore stand at 0%.`
        : `${name} attended "${templateName}" ${
            metrics.lateMinutes > 0 ? `${metrics.lateMinutes} minute(s) late` : "on time"
          }, completing ${formatDuration(metrics.workedMinutes)} of a scheduled ${formatDuration(
            metrics.scheduledMinutes
          )}. Punctuality scored ${metrics.punctualityScore}%, schedule adherence ${metrics.activityAdherenceScore}% and time-on-task ${metrics.workScore}%.`,
      workSummary: absent
        ? "No work was performed in the scheduled window. The monitoring session was never created, so there are no screenshots, activity samples or events to review."
        : screenLine,
      verdict: absent
        ? "This shift is a missed-attendance event that requires follow-up rather than a performance judgement. Restoring reliable attendance is the only priority for the next period."
        : `${overallScore >= 80 ? "This is a dependable shift." : overallScore >= 70 ? "This is a workable shift with clear improvement points." : "This shift needs active management before it becomes a pattern."} ${
            concerns.length ? concerns[0] : "Nothing in the evidence contradicts the score."
          }`,
      highlights,
      concerns,
      sections: {
        attendance: attendanceLine,
        time: timeLine,
        productivity: productivityLine,
        screen: screenLine,
        risk: riskLine,
        coaching: coachingActions.length
          ? `The next conversation with ${name} should cover: ${coachingActions.join(" ")}`
          : "No coaching action is required from this shift.",
        outlook: outlookLine,
      },
    },
    timeline: buildFallbackTimeline(context),
    recommendations: (absent
      ? [
          {
            title: "Confirm the absence and restore coverage",
            detail:
              "Contact the worker the same day, confirm whether the absence was approved and record the outcome against the attendance policy.",
            priority: "high" as const,
          },
          {
            title: "Agree a make-up or cover plan",
            detail: `The ${formatDuration(metrics.scheduledMinutes)} window was uncovered; agree who covers it and confirm the next scheduled shift.`,
            priority: "medium" as const,
          },
        ]
      : [
          coachingActions[0]
            ? {
                title: "Coach the weakest signal",
                detail: String(coachingActions[0]),
                priority: "high" as const,
              }
            : {
                title: "Maintain the current standard",
                detail: "Share the report with the worker and keep the current schedule and tooling unchanged.",
                priority: "low" as const,
              },
          {
            title: "Review the screen evidence",
            detail: observedApps.length
              ? `Spot-check the windows around ${derived.peakHour || "the peak hour"} against the ${observedApps.slice(0, 3).join(", ")} workstreams before the next check-in.`
              : "Review the captured screenshots manually to confirm the work described in this report.",
            priority: "medium" as const,
          },
        ]) satisfies IAnalysisRecommendation[],
  };

  report.narrative.sections = enrichShiftSections(context, overallScore, report.narrative.sections);
  report.narrative.executiveSummary = `${report.narrative.executiveSummary}\n\n${
    absent
      ? "The report is short by necessity: an absent shift produces attendance and coverage findings, not work findings. It is still complete, and the recommendations below are the operative part."
      : `For context, the platform weights punctuality at ${metrics.punctualityScore}%, schedule adherence at ${metrics.activityAdherenceScore}% and time-on-task at ${metrics.workScore}%, which produces the ${overallScore}% overall score. Every figure in this report comes from the same inputs the score was computed from, so the narrative can be audited line by line against the dashboard.`
  }`;

  return report;
};

/**
 * Extra analytical paragraphs appended to the deterministic shift report so the
 * fallback is a complete document rather than a summary stub.
 */
const enrichShiftSections = (
  context: ShiftAnalysisContext,
  overallScore: number,
  base: ShiftNarrative["sections"]
): ShiftNarrative["sections"] => {
  const { metrics, derived } = context;
  const absent = metrics.attendanceStatus === "absent";
  const workedPlusBreaks = metrics.workedMinutes + metrics.breakMinutes;
  const accountedPercent = metrics.scheduledMinutes
    ? Math.round((workedPlusBreaks / metrics.scheduledMinutes) * 100)
    : 0;

  const attendanceExtra = absent
    ? "Attendance is recorded directly, so there is no ambiguity in this section: the scheduled window opened and closed without a clock-in or a monitoring session. The absence should be confirmed as approved or unapproved before any performance action is considered."
    : `Across the scheduled ${formatDuration(metrics.scheduledMinutes)} the worker accounted for ${formatDuration(
        workedPlusBreaks
      )} of work and breaks (${accountedPercent}%), leaving ${formatDuration(
        derived.idleMinutes
      )} unaccounted for. ${
        metrics.lateMinutes > 0
          ? `The ${metrics.lateMinutes}-minute late start is the only punctuality deduction, and the ${metrics.punctualityScore}% score reflects it directly.`
          : "There was no lateness deduction: the clock-in matched the scheduled start."
      } ${
        metrics.overtimeMinutes > 0
          ? `${formatDuration(metrics.overtimeMinutes)} of overtime was recorded after the scheduled end and should be checked against the agreed tolerance rather than assumed to be scope creep.`
          : "No overtime was recorded, so the shift closed inside its scheduled window."
      }`;

  const timeExtra = absent
    ? "With no recorded work there is no time distribution to analyse. The scheduled minutes were fully missed, and that loss is the only time finding the data supports."
    : `The hourly distribution matters more than the total. Activity concentrated at ${derived.peakHour || "no recorded hour"} and the quietest active hour was ${
        derived.quietestHour || "not established"
      } across ${derived.observedSpanHours} observed hours. ${
        derived.longestGapMinutes >= 90
          ? `The ${formatDuration(derived.longestGapMinutes)} gap between ${derived.longestGapWindow} is long enough to warrant a break-record check.`
          : "No gap exceeded 90 minutes, so the day reads as continuous rather than fragmented."
      } ${
        derived.idleMinutes > 0
          ? `The ${formatDuration(derived.idleMinutes)} not covered by work or recorded breaks is the figure to reconcile first if the timesheet is questioned.`
          : "Every scheduled minute is covered by work or recorded breaks."
      }`;

  const productivityExtra = absent
    ? "No activity samples exist for an absent shift. The 0% engagement figure is a data-completeness fact, not an observation about the worker's effort."
    : `Normalised by active time, the worker produced roughly ${derived.movementsPerActiveHour.toLocaleString(
        "en-GB"
      )} mouse movements, ${derived.clicksPerActiveHour} clicks and ${derived.scrollsPerActiveHour} scrolls per active hour. Those rates sit in the range expected for ticket and spreadsheet work rather than passive screen time, and active time covers ${derived.activeToWorkedPercent}% of recorded work time. Treat the reading as a sample: the monitor records one-minute buckets and does not observe keyboard input or output produced.`;

  const screenExtra = absent
    ? "There are no screenshots to narrate, so the screen section is closed rather than inferred."
    : `The narration covered ${derived.screenBlocks} window(s) at ${derived.averageScreenConfidence}% average confidence, drawn from ${metrics.monitoring.captureCount} stored screenshots. ${
        derived.topTasks.length
          ? `Recurring task labels were ${derived.topTasks.slice(0, 5).join(", ")}.`
          : "No recurring task labels were extracted."
      } Because windows are sampled rather than continuous, a gap between windows is not evidence of inactivity; the only windows that show no work are the ones the narration itself marks idle.`;

  const riskExtra = absent
    ? "The operational risk is coverage, and the compliance question is whether the absence was approved. Both are administrative follow-ups, not performance findings."
    : `Two data limitations are worth stating plainly. First, activity metrics measure input rather than output: a worker reading a long document produces almost no mouse movement. Second, the screen narration samples the day, so it can miss a short task entirely. Neither limitation affects the attendance or time figures, which are recorded directly. ${
        metrics.activityAdherenceScore < 75
          ? `The adherence score of ${metrics.activityAdherenceScore}% is the weakest quantitative signal and deserves the first review.`
          : `Adherence at ${metrics.activityAdherenceScore}% supports the recorded work rather than contradicting it.`
      }`;

  const coachingExtra = absent
    ? "The next step is procedural: confirm the reason for the absence, record the outcome against the attendance policy, and agree cover for the missed window."
    : `A workable plan for the next period: review this report with the worker and confirm the numbers together; pick one behaviour — start time, break length or focus during lulls — and agree a concrete, observable change; then re-run the report at the end of the next period and compare the same metrics rather than impressions. Keep the plan to one behaviour at a time. At ${overallScore}% the priority is ${
        overallScore >= 75 ? "maintenance rather than recovery" : "recovery, starting with attendance reliability"
      }.`;

  const outlookExtra = absent
    ? "The next period should be judged on restored attendance. A single missed shift is recoverable; a pattern is not, and the report after next will show which one this was."
    : `Next period, watch three numbers: utilisation (currently ${derived.timeUtilisationPercent}%), active-to-worked (${derived.activeToWorkedPercent}%) and punctuality (${metrics.punctualityScore}%). If all three hold at or above this shift's level, the assignment is stable. A simultaneous drop in two of them is the earliest signal that the pattern is changing.`;

  return {
    attendance: `${base.attendance}\n\n${attendanceExtra}`,
    time: `${base.time}\n\n${timeExtra}`,
    productivity: `${base.productivity}\n\n${productivityExtra}`,
    screen: `${base.screen}\n\n${screenExtra}`,
    risk: `${base.risk}\n\n${riskExtra}`,
    coaching: `${base.coaching}\n\n${coachingExtra}`,
    outlook: `${base.outlook}\n\n${outlookExtra}`,
  };
};

const buildFallbackTimeline = (context: ShiftAnalysisContext): IAnalysisTimelineEntry[] => {
  const { metrics, screen } = context;
  const entries: IAnalysisTimelineEntry[] = [
    {
      time: context.shift.clockInLabel || context.shift.shiftStartLabel || "Start",
      title: metrics.attendanceStatus === "absent" ? "No clock-in recorded" : "Shift began",
      detail:
        metrics.attendanceStatus === "absent"
          ? "The scheduled window opened with no attendance event."
          : `Clocked in${metrics.lateMinutes ? ` ${metrics.lateMinutes} minute(s) late` : " on time"}.`,
    },
  ];

  for (const block of screen.blocks.slice(0, 6)) {
    entries.push({
      time: block.window,
      title: block.activity === "idle" ? "Idle window" : block.tasks[0] || "Screen activity",
      detail: block.summary,
    });
  }

  if (metrics.attendanceStatus !== "absent") {
    entries.push({
      time: context.shift.clockOutLabel || "End",
      title: "Shift concluded",
      detail: `${formatDuration(metrics.workedMinutes)} worked; session closed through ${closureLabel(
        metrics.closureReason
      )}.`,
    });
  }

  return entries;
};

// ---------------------------------------------------------------------------
// Period report
// ---------------------------------------------------------------------------
const PERIOD_CONTRACT = `{
  "headline": "one sentence (max 120 chars) summarising the period",
  "executiveSummary": "5-7 paragraphs separated by \\n\\n, 500-800 words, the full narrative of the period",
  "summary": "4-6 sentences (legacy field, still rendered)",
  "sections": {
    "performance": "300-450 words comparing and explaining performance",
    "attendance": "200-300 words on attendance, punctuality, breaks and overtime",
    "screenStory": "350-500 words of chronological storytelling from the screenshot evidence: what work was done, with which tools, and how the period unfolded",
    "patterns": "250-350 words on working patterns, peaks, quiet hours and consistency",
    "risks": "180-280 words on risks, inconsistencies and compliance points",
    "recommendations": "250-350 words of practical recommendations",
    "outlook": "150-250 words on what the next period should look like"
  },
  "verdict": "3-5 sentences giving the hiring manager a clear conclusion",
  "workerNotes": [{"name": "exact worker name", "summary": "150-220 words", "strengths": ["2-4"], "watchouts": ["0-4"], "recommendation": "1-2 sentences"}],
  "timeline": [{"time": "week or date label", "title": "short label", "detail": "1-2 sentences"}],
  "highlights": ["5 to 8 specific observations"],
  "concerns": ["3 to 6 specific risks (empty array if genuinely none)"]
}`;

const PERIOD_SYSTEM_PROMPT = [
  "You are a senior workforce analyst at ShiftSync by Advanced Virtual Solutions, writing a long-form period performance report for a hiring manager.",
  "You are given every analysed shift in the period: scores, attendance, time, breaks, overtime, activity, and a chronological narration of what the worker's screens showed, captured from periodic screenshots.",
  "Write in British English, in the past tense, in the third person. Address the hiring manager as the reader.",
  "Length and depth: this is a substantial report. The executive summary is 5-7 paragraphs, each section is 3-5 paragraphs, each worker note is 150-220 words, and the whole report should read as 2,000-3,000 words. Never pad; every paragraph must carry a number, an observation or an action.",
  "Hard rules:",
  "1. Use only the numbers supplied. Never invent metrics, dates, applications, tasks or outcomes. Scores are percentages from 0 to 100; durations are minutes unless labelled otherwise.",
  "2. The screen evidence is a sample of periodic screenshots, not continuous surveillance. Describe what the windows show, and say plainly when a window was quiet. Never infer misconduct from a quiet screen.",
  "3. Tell the story of the period chronologically in the screenStory section: which weeks were busiest, which tools and task types recurred, and how the work changed over time. Quote the windows and applications that appear in the evidence.",
  "4. Name workers exactly as they are listed in the data when comparing them. Do not invent workers.",
  "5. Never reproduce personal data — customer names, email addresses, phone numbers, card numbers or addresses. Refer to such records generically.",
  "6. Never mention which model or vendor produced this report, and never refer to yourself as an AI.",
  "7. Do not use markdown, headings, bullet characters or tables inside the prose fields. Plain sentences only. The array fields are the only lists.",
  "8. If a worker has no screen evidence, say so in their note instead of guessing.",
  "9. Where the period is short or the sample small, say that the conclusions are provisional rather than overstating them.",
  `Respond with strict JSON only, exactly matching this contract: ${PERIOD_CONTRACT}`,
].join(" ");

const workerNoteFallback = (row: AggregateWorkerRow): IPeriodWorkerNote => ({
  name: row.name,
  summary: `${row.name} completed ${row.shiftCount} analysed shift${row.shiftCount === 1 ? "" : "s"} in this period${
    row.absentCount ? `, with ${row.absentCount} absence${row.absentCount === 1 ? "" : "s"}` : ""
  }, averaging ${row.averageScore}% overall and ${row.averageAdherence}% schedule adherence. ${formatDuration(
    row.workedMinutes
  )} of work was recorded against ${formatDuration(row.scheduledMinutes)} scheduled.${
    row.screenBlocks
      ? ` Screen narration covered ${row.screenBlocks} window${row.screenBlocks === 1 ? "" : "s"} across ${row.screenShifts} shift${row.screenShifts === 1 ? "" : "s"}.`
      : " No screen narration was available for this worker's shifts."
  }`,
  strengths:
    row.averageScore >= 75
      ? [`Average performance of ${row.averageScore}% across ${row.shiftCount} shifts.`]
      : [],
  watchouts:
    row.averageScore < 70
      ? [`Average performance of ${row.averageScore}% sits below the 70% comfort line.`]
      : row.absentCount > 0
        ? [`${row.absentCount} absence(s) in the period.`]
        : [],
  recommendation:
    row.averageScore >= 80
      ? "Continue the current assignment and keep the weekly review cadence."
      : row.averageScore >= 70
        ? "Continue with a targeted coaching plan on the weakest KPI."
        : "Put a structured improvement plan in place and review at the end of the next period.",
});

export const buildAggregatePrompt = (context: AggregateContext) => {
  const { range, totals, rows, period, story, shifts, workerScreenNotes } = context;
  const singleWorker = rows.length === 1;

  const userPrompt = JSON.stringify({
    reportFor: "Hiring manager",
    scope: singleWorker ? `single worker: ${rows[0]?.name}` : `team of ${rows.length} workers`,
    period: {
      startDate: range.startDate,
      endDate: range.endDate,
      calendarDays: period.dayCount,
      daysWithRecordedWork: period.recordedDays,
    },
    scoreDefinitions: {
      overallScore: "weighted 0-100 KPI score per concluded shift",
      adherence: "0-100, how closely the shift matched the planned schedule",
      punctuality: "0-100, derived from lateness on clock-in",
      activePercent: "percentage of tracked one-minute samples with any mouse activity",
    },
    totals,
    periodAnalytics: {
      utilisationPercent: period.utilisationPercent,
      presencePercent: period.presencePercent,
      attendance: period.attendance,
      closureReasons: period.closures,
      weeklyTrend: period.weeklyTrend,
      activityByHour: period.hourlyActivity,
      topApplications: period.topApps,
      recurringTasks: period.topTasks,
      screenCoverage: period.screen,
    },
    workers: rows.map((row) => ({
      name: row.name,
      shifts: row.shiftCount,
      absences: row.absentCount,
      lateShifts: row.lateShifts,
      averageScore: row.averageScore,
      averageAdherence: row.averageAdherence,
      averagePunctuality: row.averagePunctuality,
      workedMinutes: row.workedMinutes,
      scheduledMinutes: row.scheduledMinutes,
      breakMinutes: row.breakMinutes,
      overtimeMinutes: row.overtimeMinutes,
      averageMinutesPerShift: row.averageWorkedMinutes,
      screenWindows: row.screenBlocks,
      screenShifts: row.screenShifts,
      focusedWindows: row.focusedBlocks,
      idleWindows: row.idleBlocks,
      bestShift: { date: row.bestDate, score: row.bestScore },
      weakestShift: { date: row.worstDate, score: row.worstScore },
      firstDate: row.firstDate,
      lastDate: row.lastDate,
    })),
    screenStoryChronology: story.map((beat) => ({
      when: `${beat.date} ${beat.label}`,
      worker: beat.worker,
      activity: beat.activity,
      summary: beat.summary,
      apps: beat.apps,
      tasks: beat.tasks,
      confidence: beat.confidence,
    })),
    screenNotesByWorker: workerScreenNotes,
    shiftLog: shifts.map((shift) => ({
      date: shift.date,
      worker: shift.worker,
      score: shift.score,
      adherence: shift.adherence,
      workedMinutes: shift.workedMinutes,
      scheduledMinutes: shift.scheduledMinutes,
      attendance: shift.attendance,
      closure: shift.closure,
      screenshots: shift.screenshots,
      screenWindows: shift.screenBlocks,
      headline: shift.headline,
    })),
    screenshotEvidenceAvailable: story.length > 0,
    note: story.length
      ? "Screen evidence is available: the screenStory section must be a chronological narrative built from it."
      : "No screen narration is available in this period. State that plainly in screenStory and do not speculate about on-screen work.",
  });

  return {
    systemPrompt: PERIOD_SYSTEM_PROMPT,
    userPrompt,
    singleWorker,
  };
};

export const sanitizePeriodReport = (
  raw: any,
  rows: AggregateWorkerRow[],
  fallback: PeriodNarrative
): PeriodNarrative => {
  const sectionsRaw = raw?.sections && typeof raw.sections === "object" ? raw.sections : {};
  const sections = {} as IPeriodSections;
  for (const key of PERIOD_SECTION_ORDER) {
    sections[key] = text((sectionsRaw as any)[key], 6000) || fallback.sections[key];
  }

  const byName = new Map(rows.map((row) => [row.name.trim().toLowerCase(), row]));
  const notesRaw = Array.isArray(raw?.workerNotes) ? raw.workerNotes : [];
  const merged = new Map<string, IPeriodWorkerNote>();

  for (const note of notesRaw) {
    const key = text(note?.name, 120).trim().toLowerCase();
    const row = byName.get(key);
    if (!row || merged.has(row.userId)) continue;
    merged.set(row.userId, {
      name: row.name,
      summary: text(note?.summary, 2400) || workerNoteFallback(row).summary,
      strengths: textList(note?.strengths, 4, 200),
      watchouts: textList(note?.watchouts, 4, 200),
      recommendation: text(note?.recommendation, 600) || workerNoteFallback(row).recommendation,
    });
  }

  for (const row of rows) {
    if (!merged.has(row.userId)) merged.set(row.userId, workerNoteFallback(row));
  }

  return {
    headline: text(raw?.headline, 220) || fallback.headline,
    summary: text(raw?.summary, 2400) || fallback.summary,
    executiveSummary: text(raw?.executiveSummary, 9000) || fallback.executiveSummary,
    verdict: text(raw?.verdict, 1400) || fallback.verdict,
    sections,
    workerNotes: [...merged.values()],
    highlights: textList(raw?.highlights, 8).length
      ? textList(raw?.highlights, 8)
      : fallback.highlights,
    concerns: Array.isArray(raw?.concerns) ? textList(raw.concerns, 6) : fallback.concerns,
  };
};

// ---------------------------------------------------------------------------
// Deterministic period report
// ---------------------------------------------------------------------------
export const buildFallbackPeriodReport = (context: AggregateContext): PeriodNarrative => {
  const { range, totals, rows, period, story } = context;
  const singleWorker = rows.length === 1;
  const top = rows[0];
  const lowest = rows[rows.length - 1];
  const name = singleWorker ? top.name : null;
  const highlights: string[] = [];
  const concerns: string[] = [];
  const apps = period.topApps.map((app) => app.name);

  if (singleWorker) {
    highlights.push(`${name} completed ${totals.analyses} analysed shift(s) in this period.`);
    if (top.averageAdherence >= 80)
      highlights.push(`Schedule adherence averaged ${top.averageAdherence}% across the period.`);
    highlights.push(
      `${formatDuration(totals.workedMinutes)} of work was recorded against ${formatDuration(
        totals.scheduledMinutes
      )} scheduled.`
    );
    if (top.screenBlocks)
      highlights.push(`${top.screenBlocks} screen windows were narrated from stored screenshots.`);
    if (top.averageScore < 70)
      concerns.push(
        `The average performance score of ${top.averageScore}% is below the 70% comfort line.`
      );
    if (totals.absentCount > 0)
      concerns.push(`${totals.absentCount} absent shift(s) were recorded in this period.`);
  } else {
    if (top)
      highlights.push(
        `${top.name} leads the period with ${top.averageScore}% average performance across ${top.shiftCount} analysed shift(s).`
      );
    if (totals.averageAdherence >= 80)
      highlights.push(`Schedule adherence averaged ${totals.averageAdherence}% for the period.`);
    highlights.push(
      `${totals.analyses} concluded shift(s) were analysed, covering ${formatDuration(
        totals.workedMinutes
      )} of recorded work.`
    );
    if (lowest && lowest.averageScore < 70)
      concerns.push(`${lowest.name} averaged ${lowest.averageScore}% — the lowest score of the period.`);
    if (totals.absentCount > 0)
      concerns.push(`${totals.absentCount} absent shift(s) were recorded in this period.`);
  }
  if (totals.lateShifts > 0)
    concerns.push(`${totals.lateShifts} shift(s) started late, totalling ${totals.lateMinutes} late minutes.`);
  if (totals.overtimeMinutes > 0)
    concerns.push(`${formatDuration(totals.overtimeMinutes)} of overtime was recorded in the period.`);

  const performanceSection = singleWorker
    ? `${name} closed ${totals.analyses} analysed shift(s) between ${range.startDate} and ${range.endDate}, averaging ${top.averageScore}% overall and ${top.averageAdherence}% schedule adherence. The spread between the best shift (${top.bestScore}% on ${top.bestDate}) and the weakest (${top.worstScore}% on ${top.worstDate}) is ${top.scoreSpread} points, which is the clearest signal of consistency in the data.\n\n${
        top.averageScore >= 80
          ? "That average sits in the strong band: the work is dependable and the remaining gains are about consistency rather than capability."
          : top.averageScore >= 70
            ? "That average sits in the steady band: acceptable delivery, with identifiable room to improve the weakest KPI."
            : "That average sits below the comfortable line and warrants a structured improvement plan."
      } ${formatDuration(top.workedMinutes)} of work was recorded across ${top.shiftCount} shift(s), or ${formatDuration(
        top.averageWorkedMinutes
      )} per shift on average.`
    : `Between ${range.startDate} and ${range.endDate}, ${totals.workers} workers generated ${totals.analyses} analysed shifts, averaging ${totals.averageScore}% overall and ${totals.averageAdherence}% adherence. ${formatDuration(
        totals.workedMinutes
      )} of work was recorded against ${formatDuration(totals.scheduledMinutes)} scheduled.\n\n${top.name} led the period at ${top.averageScore}% across ${top.shiftCount} shifts, while ${lowest.name} closed at ${lowest.averageScore}%. The gap between them is ${
        top.averageScore - lowest.averageScore
      } points, which is wide enough to justify differentiated review cadences.`;

  const attendanceSection = `Attendance across the period breaks down as ${period.attendance.onTime} on-time shift(s), ${period.attendance.late} late, ${period.attendance.veryLate} very late, ${period.attendance.absent} absent and ${period.attendance.overtime} recorded as overtime. Utilisation — worked minutes against scheduled minutes — was ${period.utilisationPercent}%, with ${formatDuration(
    totals.breakMinutes
  )} of breaks and ${formatDuration(totals.overtimeMinutes)} of overtime in the same window.\n\n${
    totals.absentCount
      ? `${totals.absentCount} absence(s) is the most serious attendance signal in the period and should be discussed directly with the worker.`
      : "No absences were recorded, which is the strongest attendance result available in this dataset."
  } ${
    totals.lateShifts
      ? `${totals.lateShifts} late start(s) totalling ${totals.lateMinutes} minute(s) suggest a start-of-day reliability issue rather than a one-off.`
      : "Every recorded shift started on time."
  }`;

  const screenSection = story.length
    ? `The stored screenshots were narrated into ${period.screen.blocks} windows across ${period.screen.narratedShifts} shift(s). ${period.screen.focused} window(s) read as focused work, ${period.screen.mixed} as mixed activity and ${period.screen.idle} as idle or blank.\n\n${story
        .slice(0, 8)
        .map((beat) => `${beat.date} ${beat.label}: ${beat.summary}`)
        .join(" ")}${story.length > 8 ? " The remaining windows follow the same pattern." : ""}${
        apps.length ? ` The dominant applications across the period were ${apps.slice(0, 5).join(", ")}.` : ""
      }`
    : `No screen narration is available for this period, so the report cannot describe the applications or documents in use. ${period.screen.screenshots} screenshot(s) remain stored as evidence and can be reviewed manually.`;

  const patternsSection = `Activity concentrated around ${period.hourlyActivity
    .slice()
    .sort((left, right) => right.activeMinutes - left.activeMinutes)
    .slice(0, 3)
    .map((bucket) => bucket.hour)
    .join(", ") || "no recorded hours"} across the period. Working time covered ${period.recordedDays} day(s) out of ${period.dayCount} calendar days in the window.\n\nWeekly movement: ${
    period.weeklyTrend
      .map((week) => `${week.label} ${week.averageScore}% (${week.shifts} shift(s))`)
      .join("; ") || "no completed weeks in range"
  }. ${
    period.topTasks.length
      ? `Recurring task types were ${period.topTasks.slice(0, 6).join(", ")}.`
      : "Task types were not consistently identifiable in the screen evidence."
  }`;

  const riskSection = `${concerns.length ? concerns.join(" ") : "No material risks were identified in the period."} ${
    period.screen.idle > period.screen.focused
      ? "Idle windows outnumber focused windows in the screen evidence, which is a coverage question worth checking against the schedule rather than a performance conclusion on its own."
      : "The balance of focused to idle windows in the screen evidence is consistent with the recorded scores."
  }`;

  const recommendationsSection = singleWorker
    ? `For ${name}: ${
        top.averageScore >= 80
          ? "continue the current assignment and keep a light weekly review."
          : top.averageScore >= 70
            ? "agree a two-week coaching focus on the weakest KPI and review it at the next period end."
            : "put a formal improvement plan in place with weekly checkpoints."
      } Share this report with the worker so the evidence behind the score is transparent, and keep the screen-evidence review cadence unchanged.`
    : `For the team: keep ${top.name} on the current review cadence, and put additional support behind ${lowest.name}. Share the per-worker notes with each worker individually rather than circulating the team report, and keep the screen-evidence review cadence unchanged.`;

  const outlook = `The next period should be judged on three things: attendance reliability${
    totals.absentCount || totals.lateShifts ? "" : " (already strong)"
  }, the trend of the average score, and whether screen evidence continues to show the same task mix. ${
    totals.analyses < 5
      ? "The sample in this period is small, so treat the conclusions as provisional until more shifts are analysed."
      : "The sample is large enough to treat the averages as stable."
  }`;

  const executiveSummary = singleWorker
    ? `${name} closed ${totals.analyses} analysed shift(s) between ${range.startDate} and ${range.endDate}, averaging ${top.averageScore}% overall performance and ${top.averageAdherence}% schedule adherence. ${formatDuration(
        top.workedMinutes
      )} of work was recorded against ${formatDuration(top.scheduledMinutes)} scheduled, with ${formatDuration(
        top.overtimeMinutes
      )} of overtime and ${totals.absentCount} absence(s).\n\n${performanceSection.split("\n\n")[1]}\n\n${attendanceSection.split("\n\n")[1]}\n\nThe screen evidence covers ${period.screen.blocks} narrated window(s) across ${period.screen.narratedShifts} shift(s)${
        apps.length ? `, dominated by ${apps.slice(0, 3).join(", ")}` : ""
      }. ${story.length ? "The chronological account in the screen story section sets out how the work unfolded." : "No screen narration was available, so the report does not speculate about on-screen work."}`
    : `Between ${range.startDate} and ${range.endDate}, ${totals.workers} workers produced ${totals.analyses} analysed shifts and ${formatDuration(
        totals.workedMinutes
      )} of recorded work. Average performance was ${totals.averageScore}% with ${totals.averageAdherence}% schedule adherence.\n\n${performanceSection.split("\n\n")[1]}\n\n${attendanceSection.split("\n\n")[0]}\n\nScreen evidence covered ${period.screen.blocks} windows across ${period.screen.narratedShifts} shift(s)${
        apps.length ? `, with ${apps.slice(0, 3).join(", ")} the most frequent applications` : ""
      }.`;

  const narrative: PeriodNarrative = {
    headline: singleWorker
      ? `${name}: ${totals.averageScore}% average performance across ${totals.analyses} analysed shift(s)`
      : `${totals.averageScore}% average performance across ${totals.analyses} analysed shift(s)`,
    summary: singleWorker
      ? `Between ${range.startDate} and ${range.endDate}, ${name} completed ${totals.analyses} analysed shift(s) with an average performance score of ${totals.averageScore}% and an average adherence of ${totals.averageAdherence}%. A combined ${formatDuration(
          totals.workedMinutes
        )} of work was recorded${totals.absentCount ? `, alongside ${totals.absentCount} absent shift(s)` : ""}.`
      : `Between ${range.startDate} and ${range.endDate}, ${totals.workers} worker(s) generated ${totals.analyses} analysed shifts with an average performance score of ${totals.averageScore}% and an average adherence of ${totals.averageAdherence}%. A combined ${formatDuration(
          totals.workedMinutes
        )} of work was recorded${totals.absentCount ? `, alongside ${totals.absentCount} absent shift(s)` : ""}.`,
    executiveSummary,
    verdict: singleWorker
      ? `${name}'s period is ${top.averageScore >= 80 ? "strong and should be continued" : top.averageScore >= 70 ? "steady with a clear improvement path" : "below the comfort line and needs an improvement plan"}. ${concerns[0] || "No material concerns were recorded."}`
      : `The team averaged ${totals.averageScore}% across ${totals.analyses} shifts, with ${top.name} strongest at ${top.averageScore}% and ${lowest.name} weakest at ${lowest.averageScore}%. Differentiated review cadences are justified for the next period.`,
    sections: {
      performance: performanceSection,
      attendance: attendanceSection,
      screenStory: screenSection,
      patterns: patternsSection,
      risks: riskSection,
      recommendations: recommendationsSection,
      outlook,
    },
    workerNotes: rows.map(workerNoteFallback),
    highlights,
    concerns,
  };

  narrative.sections = enrichPeriodSections(context, narrative.sections);
  narrative.executiveSummary = `${narrative.executiveSummary}\n\nMethod note: every figure in this report is derived from concluded shifts and their stored screenshots. Narration describes sampled windows rather than continuous monitoring, and the report says so wherever the sample limits a conclusion. Screenshots are reproduced only for the named hiring manager.`;

  return narrative;
};

/**
 * Extra analytical paragraphs appended to the deterministic period report. The
 * goal is a document a hiring manager can act on even when the writing engine is
 * unavailable, not a one-paragraph placeholder.
 */
const enrichPeriodSections = (
  context: AggregateContext,
  base: PeriodNarrative["sections"]
): PeriodNarrative["sections"] => {
  const { totals, rows, period, story } = context;
  const apps = period.topApps.map((app) => app.name);
  const singleWorker = rows.length === 1;
  const top = rows[0];
  const peak = [...period.hourlyActivity].sort((left, right) => right.activeMinutes - left.activeMinutes)[0];
  const quiet = [...period.hourlyActivity].sort((left, right) => left.activeMinutes - right.activeMinutes)[0];

  const performanceExtra = rows.length
    ? `The spread inside each worker's period matters as much as the average. ${rows
        .map((row) => `${row.name} ranged from ${row.worstScore}% to ${row.bestScore}% across ${row.shiftCount} shifts`)
        .join("; ")}. A wide spread usually points to inconsistent conditions — different queues or different weeks — rather than one capability level, and the weekly chart shows which weeks carried the low scores. ${
        singleWorker
          ? "For a single-worker report, that internal spread is the most useful signal in this section."
          : `Read together, ${top.name}'s profile is the benchmark for the period and the remaining profiles are judged against it.`
      }`
    : "There are no analysed shifts in this range, so no performance distribution can be described.";

  const attendanceExtra = `Utilisation of ${period.utilisationPercent}% means ${formatDuration(
    totals.workedMinutes
  )} of work against ${formatDuration(totals.scheduledMinutes)} scheduled. ${totals.absentCount} absence(s) and ${
    totals.lateShifts
  } late start(s) (${totals.lateMinutes} minutes) account for most of the shortfall; breaks account for ${formatDuration(
    totals.breakMinutes
  )} and overtime for ${formatDuration(
    totals.overtimeMinutes
  )}. Presence was ${period.presencePercent}% of analysed shifts, and ${period.recordedDays} of the ${period.dayCount} calendar days in scope carried recorded work.`;

  const screenExtra = `Across the period ${period.screen.screenshots} screenshots were stored, ${period.screen.narratedShifts} shifts were narrated into ${period.screen.blocks} windows: ${period.screen.focused} read as focused, ${period.screen.mixed} as mixed and ${period.screen.idle} as idle. ${
    apps.length ? `The most frequent applications were ${apps.slice(0, 5).join(", ")}.` : "No dominant application could be established."
  } The chronology is a sample of each day, so this report treats a gap between windows as unobserved rather than idle, and only calls a window idle when the narration says so.`;

  const patternsExtra = `Weekly movement was ${
    period.weeklyTrend.map((week) => `${week.label} ${week.averageScore}% (${week.shifts} shifts)`).join("; ") ||
    "not available for this range"
  }. Activity by hour peaked at ${peak?.hour || "no recorded hour"} with ${peak?.activeMinutes || 0} active minutes across the period and troughed at ${
    quiet?.hour || "not established"
  }. ${
    period.topTasks.length
      ? `The task mix is stable around ${period.topTasks.slice(0, 4).map((task) => task.name).join(", ")}.`
      : "Task labels were too sparse to establish a mix."
  } With ${story.length} narrated window(s) in the story timeline, the pattern is described from evidence rather than from the shift count alone.`;

  const risksExtra = `Each risk has a matching control. For reliability, a two-week review rather than a month-end one; for coverage, a named backup for the queue; for consistency, a short written expectation of start time and break boundaries. None of the risks in this period require a disciplinary process on the current evidence. ${
    totals.absentCount > 0
      ? "Absence is the one finding that should be confirmed as approved or unapproved before any performance action."
      : "With no absences recorded, the risk section is about drift rather than attendance."
  }`;

  const recommendationsExtra = `Sequencing matters: fix attendance first, then consistency, then output. Attendance is the precondition for every other metric, and the periods where it slipped are also the periods with the lowest scores. Reviewing all three at once spreads attention without changing behaviour. Share per-worker sections with each worker individually rather than circulating the whole report.`;

  const outlookExtra = `Because the period contains ${totals.analyses} analysed shifts, the averages are ${
    totals.analyses >= 20 ? "stable enough to act on" : "indicative rather than conclusive"
  }. The next report should be read against the same three thresholds — utilisation, absence count and average score — so movement is visible without re-reading the whole document.`;

  return {
    performance: `${base.performance}\n\n${performanceExtra}`,
    attendance: `${base.attendance}\n\n${attendanceExtra}`,
    screenStory: `${base.screenStory}\n\n${screenExtra}`,
    patterns: `${base.patterns}\n\n${patternsExtra}`,
    risks: `${base.risks}\n\n${risksExtra}`,
    recommendations: `${base.recommendations}\n\n${recommendationsExtra}`,
    outlook: `${base.outlook}\n\n${outlookExtra}`,
  };
};

