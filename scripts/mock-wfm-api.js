// Minimal WFM API mock for local UI verification. Serves canned data for all
// endpoints the dashboard uses. Login email picks the role:
//   admin@demo.test / manager@demo.test / agent@demo.test (any password)
const http = require("http");

const PORT = 5000;

const AGENT = {
  _id: "a001agent0000000000000001",
  name: "Ada Okafor",
  email: "agent@demo.test",
  role: "agent",
  accountStatus: "approved",
  mfaEnabled: true,
};
const MANAGER = {
  _id: "b002manager00000000000001",
  name: "Marcus Boyd",
  email: "manager@demo.test",
  role: "supervisor",
  accountStatus: "approved",
  mfaEnabled: false,
  organizationName: "Boyd Hiring Co.",
  organizationAddress: "12 Fleet Street, London",
  companyNumber: "00987761",
  assignedAgentIds: [AGENT._id],
};
const ADMIN = {
  _id: "c003admin0000000000000001",
  name: "Sonia Reyes",
  email: "admin@demo.test",
  role: "admin",
  accountStatus: "approved",
  mfaEnabled: true,
};
const AGENT2 = { ...AGENT, _id: "a004agent0000000000000002", name: "Liam Chen", email: "liam@demo.test" };

const TIME_TEMPLATE = {
  _id: "t001template000000000000001",
  name: "Day Operations",
  scheduleType: "time_managed",
  startTime: "08:00",
  endTime: "17:00",
  isActive: true,
  breaks: [
    { label: "Morning break", type: "break", mode: "static", startTime: "10:00", endTime: "10:30", durationMinutes: 30, startAt: "2026-09-18T09:00:00.000Z", endAt: "2026-09-18T09:30:00.000Z" },
    { label: "Lunch", type: "lunch", mode: "dynamic", durationMinutes: 45 },
  ],
  activities: [
    { label: "Meeting", type: "meeting", startTime: "11:00", endTime: "11:30", durationMinutes: 30, startAt: "2026-09-18T10:00:00.000Z", endAt: "2026-09-18T10:30:00.000Z" },
  ],
};
const FLUID_TEMPLATE = {
  _id: "t002template000000000000002",
  name: "Fluid Support Pool",
  scheduleType: "fluid",
  isActive: true,
  breaks: [
    { label: "Morning break", type: "break", mode: "dynamic", durationMinutes: 15 },
    { label: "Lunch", type: "lunch", mode: "dynamic", durationMinutes: 45 },
  ],
  activities: [
    { label: "Training", type: "training", durationMinutes: 30 },
  ],
};
const SHORT_TEMPLATE = {
  _id: "t003template000000000000003",
  name: "Micro Shift 30m",
  scheduleType: "time_managed",
  startTime: "09:30",
  endTime: "10:00",
  isActive: true,
  breaks: [
    { label: "Morning break", type: "break", mode: "static", startTime: "09:45", endTime: "09:55", durationMinutes: 10, startAt: "2026-09-18T08:45:00.000Z", endAt: "2026-09-18T08:55:00.000Z" },
  ],
  activities: [],
};

const today = new Date();
const dayKey = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const scheduleFor = (template, userId, offset) => ({
  _id: `s${offset}${userId.slice(0, 8)}${template._id.slice(1, 10)}`,
  userId,
  shiftTemplateId: template,
  workDate: `${dayKey(offset)}T00:00:00.000Z`,
  scheduleType: template.scheduleType,
  scheduledStartTime: template.scheduleType === "fluid" ? undefined : `${dayKey(offset)}T07:00:00.000Z`,
  scheduledEndTime: template.scheduleType === "fluid" ? undefined : `${dayKey(offset)}T16:00:00.000Z`,
  scheduledMinutes: template.scheduleType === "fluid" ? 0 : 540,
});

const agentSchedules = [
  scheduleFor(TIME_TEMPLATE, AGENT._id, 0),
  scheduleFor(FLUID_TEMPLATE, AGENT._id, 1),
  scheduleFor(SHORT_TEMPLATE, AGENT._id, 2),
  scheduleFor(TIME_TEMPLATE, AGENT._id, 3),
];

const activeShift = {
  shift: {
    _id: "f000shift00000000000000001",
    userId: AGENT._id,
    scheduleId: agentSchedules[0]._id,
    shiftTemplateId: TIME_TEMPLATE._id,
    scheduleType: "time_managed",
    clockInTime: `${dayKey(0)}T07:58:00.000Z`,
    scheduledStartTime: `${dayKey(0)}T07:00:00.000Z`,
    scheduledEndTime: `${dayKey(0)}T16:00:00.000Z`,
    status: "active",
    attendanceStatus: "on_time",
    lateMinutes: 0,
    overtimeMinutes: 0,
    totalWorkedMinutes: 96,
    totalBreakMinutes: 15,
  },
  currentState: "WORK_START",
};

const events = [
  { _id: "e1", shiftId: activeShift.shift._id, userId: AGENT._id, type: "SHIFT_START", timestamp: `${dayKey(0)}T07:58:00.000Z` },
  { _id: "e2", shiftId: activeShift.shift._id, userId: AGENT._id, type: "WORK_START", timestamp: `${dayKey(0)}T08:00:00.000Z` },
  { _id: "e3", shiftId: activeShift.shift._id, userId: AGENT._id, type: "BREAK_START", timestamp: `${dayKey(0)}T09:58:00.000Z` },
  { _id: "e4", shiftId: activeShift.shift._id, userId: AGENT._id, type: "BREAK_END", timestamp: `${dayKey(0)}T10:13:00.000Z` },
];

const dailyPerformance = {
  date: `${dayKey(0)}T00:00:00.000Z`,
  scheduled: true,
  status: "on_time",
  overallScore: 87,
  adherenceScore: 92,
  workedMinutes: 96,
  scheduledMinutes: 540,
  breakMinutes: 15,
  lateMinutes: 0,
  overtimeMinutes: 0,
  breakdown: { workScore: 82, punctualityScore: 100, breakScore: 92, activityAdherenceScore: 92 },
};

const overview = {
  date: `${dayKey(0)}T00:00:00.000Z`,
  totals: { users: 2, scheduled: 2, active: 1, present: 1, absent: 0, late: 0, overtime: 0, unscheduledUsers: 0, attendanceRate: 100, averagePerformance: 81, averageAdherence: 88 },
  users: [
    { user: AGENT, performance: dailyPerformance },
    { user: AGENT2, performance: { ...dailyPerformance, overallScore: 74, adherenceScore: 66, workedMinutes: 0, status: "scheduled", scheduledMinutes: 540 } },
  ],
  schedules: agentSchedules,
};

const monitoringSummary = (id, offset, captures, status) => ({
  _id: id,
  userId: AGENT._id,
  shiftSessionId: `f000shift000000000000000${offset}`,
  scheduleType: offset % 2 ? "fluid" : "time_managed",
  status,
  startedAt: `${dayKey(offset)}T08:00:00.000Z`,
  endedAt: status === "active" ? null : `${dayKey(offset)}T16:04:00.000Z`,
  capturePlan: 8,
  captureCount: captures,
  captures: Array.from({ length: captures }, (_, i) => ({ seq: i + 1, capturedAt: `${dayKey(offset)}T0${i + 1}:12:00.000Z` })),
  mouseTotals: { movements: 18400 + offset * 900, distancePx: 912340 + offset * 40000, clicks: 212 - offset * 10, scrolls: 88 + offset * 4, sampleCount: 420 - offset * 10 },
  shift: { clockInTime: `${dayKey(offset)}T08:00:00.000Z`, clockOutTime: status === "active" ? null : `${dayKey(offset)}T16:04:00.000Z`, status: status === "active" ? "active" : "completed", attendanceStatus: "on_time", scheduleType: offset % 2 ? "fluid" : "time_managed", totalWorkedMinutes: 430 - offset * 20, totalBreakMinutes: 52 },
});

const samples = Array.from({ length: 60 }, (_, i) => ({
  at: `${dayKey(0)}T08:${String(i).padStart(2, "0")}:00.000Z`,
  movements: Math.round(60 + 240 * Math.abs(Math.sin(i / 6))),
  distancePx: Math.round(8000 + 40000 * Math.abs(Math.cos(i / 5))),
  clicks: i % 9 === 0 ? 2 : 0,
  scrolls: i % 7 === 0 ? 1 : 0,
}));

const captureDetail = (captures) => ({
  monitoring: {
    _id: "m000000000000000000000001",
    userId: AGENT._id,
    shiftSessionId: activeShift.shift._id,
    scheduleType: "time_managed",
    status: "completed",
    startedAt: `${dayKey(1)}T08:00:00.000Z`,
    endedAt: `${dayKey(1)}T16:04:00.000Z`,
    capturePlan: 8,
    captures: Array.from({ length: captures }, (_, i) => ({ _id: `cap${i}${"0".repeat(18)}`, seq: i + 1, capturedAt: `${dayKey(1)}T0${(i % 9) + 1}:12:00.000Z`, sizeBytes: 118000, width: 1280, height: 720 })),
    mouseTotals: { movements: 18400, distancePx: 912340, clicks: 212, scrolls: 88, sampleCount: 480 },
    mouseSamples: samples,
  },
  shift: { _id: activeShift.shift._id, userId: AGENT._id, clockInTime: `${dayKey(1)}T08:00:00.000Z`, clockOutTime: `${dayKey(1)}T16:04:00.000Z`, status: "completed", scheduleType: "time_managed", totalWorkedMinutes: 430, totalBreakMinutes: 52, attendanceStatus: "on_time" },
});

// 1x1 teal JPEG (tiny placeholder for gallery layout review)
const PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==",
  "base64"
);

// ---------------------------------------------------------------------------
// AI Analysis & Summary mocks — mirrors the shapes the real API returns so the
// long-form page and both PDFs can be reviewed without a backend or database.
// ---------------------------------------------------------------------------
const captureId = (index) => `cap${index}${"0".repeat(21)}`;
const captureRefs = Array.from({ length: 8 }, (_, i) => ({
  captureId: captureId(i),
  capturedAt: `${dayKey(1)}T0${(i % 9) + 1}:12:00.000Z`,
}));

const hourlyActivity = [
  { hour: "08:00", activeMinutes: 38 },
  { hour: "09:00", activeMinutes: 52 },
  { hour: "10:00", activeMinutes: 44 },
  { hour: "11:00", activeMinutes: 57 },
  { hour: "12:00", activeMinutes: 21 },
  { hour: "13:00", activeMinutes: 49 },
  { hour: "14:00", activeMinutes: 55 },
  { hour: "15:00", activeMinutes: 41 },
];

const screenBlocks = [
  {
    index: 0,
    startedAt: `${dayKey(1)}T08:05:00.000Z`,
    endedAt: `${dayKey(1)}T09:20:00.000Z`,
    summary:
      "The worker opened the Zendesk queue and worked through the overnight ticket backlog, replying to four customer threads and tagging two escalations for the billing team. A second window held the internal refund policy document, which was referenced before each reply.",
    tasks: ["Ticket triage", "Customer replies", "Policy check"],
    apps: ["Zendesk", "Chrome", "Google Docs"],
    activity: "focused",
    evidence: "Ticket #48213 — refund policy",
    confidence: 88,
    source: "ai",
    captureId: captureId(0),
    capturedAt: `${dayKey(1)}T08:12:00.000Z`,
  },
  {
    index: 1,
    startedAt: `${dayKey(1)}T10:00:00.000Z`,
    endedAt: `${dayKey(1)}T11:30:00.000Z`,
    summary:
      "Work moved to the reconciliation spreadsheet, where the worker matched 28 payment rows against the Shopify export and highlighted three mismatches. The browser stayed on the payment provider dashboard for most of the window.",
    tasks: ["Payment reconciliation", "Discrepancy log"],
    apps: ["Excel", "Stripe", "Chrome"],
    activity: "focused",
    evidence: "Reconciliation — week 44",
    confidence: 84,
    source: "ai",
    captureId: captureId(2),
    capturedAt: `${dayKey(1)}T10:12:00.000Z`,
  },
  {
    index: 2,
    startedAt: `${dayKey(1)}T13:00:00.000Z`,
    endedAt: `${dayKey(1)}T14:30:00.000Z`,
    summary:
      "The afternoon window mixed the support queue with a video call; the worker shared the reconciliation file and took notes in a shared document. Two short social-media visits were visible between tickets.",
    tasks: ["Team stand-up", "Queue coverage", "Meeting notes"],
    apps: ["Zoom", "Zendesk", "Notion", "Chrome"],
    activity: "mixed",
    evidence: "Stand-up notes — 04 Nov",
    confidence: 79,
    source: "ai",
    captureId: captureId(5),
    capturedAt: `${dayKey(1)}T13:12:00.000Z`,
  },
];

const shiftNarrative = {
  headline: "Strong, focused shift — queue cleared and reconciliation completed early",
  workerSummary:
    "Ada attended the Day Operations shift on time and completed 7h 10m of a scheduled 9h day, with 52 minutes recorded as breaks. Punctuality scored 100%, schedule adherence 92% and time-on-task 84%, producing an overall weighted score of 87%.",
  workSummary:
    "The morning was spent clearing the overnight support queue, with the refund policy document open alongside Zendesk. Work moved to payment reconciliation before lunch, where 28 rows were matched and three discrepancies logged. The afternoon combined queue coverage with a team stand-up.",
  executiveSummary:
    "Ada Okafor worked a strong shift on the Day Operations rota, clearing the overnight support backlog before 09:20 and completing the weekly payment reconciliation ahead of the afternoon stand-up. The weighted score of 87% reflects an on-time start, near-perfect schedule adherence and consistently high active engagement across the tracked day.\n\nThe shift was not without friction. Activity dipped in the 12:00 hour while the worker took a longer lunch than the schedule allows, and two brief social-media visits appeared between tickets in the afternoon. Neither materially affected output, but both are the kind of drift that compounds across a week.\n\nThe screen evidence is unusually clear for this shift: three narrated windows describe the tools in use, the specific task steps and the documents open at the time. That evidence supports the narrative rather than merely decorating it, and the reconciliation completion is verifiable from the spreadsheet and the provider dashboard.\n\nThe net assessment is that this is a dependable shift with a small coaching opportunity around break timing and focus during queue lulls.",
  verdict:
    "This is a dependable shift that delivered its main outcomes early. Continue the assignment and coach the lunch timing and afternoon focus drift before they become a pattern.",
  highlights: [
    "Overnight support queue cleared before 09:20, four tickets resolved and two escalated cleanly.",
    "Weekly payment reconciliation completed with 28 rows matched and three discrepancies logged.",
    "Punctuality at 100% with only 12 minutes of overtime recorded.",
    "Active engagement on 78% of tracked minutes, concentrated in two clear focus blocks.",
  ],
  concerns: [
    "The 12:00 hour shows 21 active minutes against a scheduled 60, consistent with an extended lunch.",
    "Two short social-media visits were visible between tickets in the afternoon window.",
  ],
  sections: {
    attendance:
      "Ada clocked in at 08:02 for an 08:00 start and clocked out at 16:04, recording 7h 10m of work and 52 minutes of breaks against a 9-hour schedule. Attendance is recorded as on time, with a punctuality score of 100% and no lateness to review.\n\nThe only attendance-adjacent signal is the break pattern: the midday break ran longer than the scheduled 45 minutes, which is visible both in the minute-level activity drop and in the recorded break total. It is a single occurrence in this shift, not a trend, and is worth a light note in the next check-in rather than formal action.",
    time:
      "Time utilisation for the shift was 80%, with 96% of the scheduled window accounted for by work or recorded breaks once the 12 minutes of overtime are included. The 32 minutes not covered by work or breaks fall in the 12:00 hour and align with the extended lunch.\n\nThe overtime is small and appears to come from finishing the reconciliation rather than from scope creep. Over the period this is a stable pattern: the worker tends to close tasks rather than hand them over at the bell, which is useful but should stay inside the agreed tolerance.",
    productivity:
      "Across 480 tracked minutes the worker was active for 374 minutes, or 78% of tracked time. Activity peaked at 11:00 with 57 active minutes and again at 14:00 with 55, matching the two narrated focus blocks. The quietest active hour was 12:00 with 21 minutes.\n\nMouse telemetry shows 18,400 movements over 912,340px, 212 clicks and 88 scroll actions, which is consistent with document and ticket work rather than passive screen time. Active time covers 87% of recorded work time, so the engagement reading is not an artefact of a single busy hour.",
    screen:
      "The screenshots tell a clear three-act story. Between 08:05 and 09:20 the screen held Zendesk and the internal refund policy: the worker replied to four customer threads, tagged escalations for billing and kept the policy document open as reference. Between 10:00 and 11:30 the work moved to the reconciliation spreadsheet, where 28 payment rows were matched against the Shopify export and three mismatches highlighted. From 13:00 the afternoon mixed the support queue with a Zoom stand-up and a shared notes document.\n\nThe applications observed — Zendesk, Chrome, Google Docs, Excel, Stripe, Zoom and Notion — match the tasks described in the shift plan. Two brief social-media visits appear between tickets in the afternoon window; they are short and did not displace queue work. Of the three narrated windows, two read as focused and one as mixed.",
    risk:
      "No compliance flags were recorded: no credentials, card numbers or customer personal data were visible in the captured windows, and no non-work application held the screen for more than a few minutes.\n\nThe two risks worth naming are behavioural rather than procedural. First, the extended lunch suggests break timing is being self-managed loosely, which will matter on days with tighter coverage. Second, the afternoon focus drift is small now but is the kind of pattern that is easier to correct early.",
    coaching:
      "The next conversation with Ada should be short and specific. Agree a visible prompt for returning from lunch on time, and ask her to flag queue lulls so the afternoon can be filled with the reconciliation follow-ups rather than ad-hoc browsing.\n\nThere is also a positive coaching opportunity: the reconciliation work was completed ahead of the stand-up, which is exactly the behaviour the rota needs. Naming that explicitly will reinforce it. No formal improvement plan is warranted from this shift.",
    outlook:
      "With punctuality at 100% and time-on-task at 84%, the next period should focus on holding the current standard rather than lifting it. If the lunch and focus drift recur across the next two weeks, a short written expectation is enough; if they do not, this report is the baseline to compare against.",
  },
};

const shiftAnalysisPayload = () => ({
  _id: "analysis0000000000000001",
  shiftSessionId: "f000shift00000000000000001",
  userId: AGENT._id,
  workDate: dayKey(1),
  status: "completed",
  source: "ai",
  overallScore: 87,
  adherenceScore: 92,
  metrics: {
    scheduleType: "time_managed",
    attendanceStatus: "on_time",
    closureReason: "manual",
    scheduledMinutes: 540,
    workedMinutes: 430,
    breakMinutes: 52,
    lateMinutes: 0,
    overtimeMinutes: 12,
    punctualityScore: 100,
    workScore: 84,
    activityAdherenceScore: 92,
    monitoring: {
      captureCount: 8,
      mouseMovements: 18400,
      mouseDistancePx: 912340,
      mouseClicks: 212,
      mouseScrolls: 88,
      mouseSampleCount: 480,
      activeSamplePercent: 78,
      hourlyActivity,
    },
    captures: captureRefs,
    eventCounts: { SHIFT_START: 1, WORK_START: 1, BREAK_START: 2, BREAK_END: 2, SHIFT_END: 1 },
  },
  derived: {
    timeUtilisationPercent: 80,
    breakSharePercent: 10,
    overtimeSharePercent: 2,
    idleMinutes: 32,
    trackedMinutes: 480,
    activeMinutes: 374,
    activeToWorkedPercent: 87,
    movementsPerActiveHour: 2952,
    clicksPerActiveHour: 34,
    scrollsPerActiveHour: 14,
    peakHour: "11:00",
    quietestHour: "12:00",
    activeHourCount: 8,
    observedSpanHours: 8,
    longestGapMinutes: 60,
    longestGapWindow: "11:00–12:00",
    screenBlocks: 3,
    focusedBlocks: 2,
    mixedBlocks: 1,
    idleBlocks: 0,
    averageScreenConfidence: 84,
    topApps: ["Zendesk", "Chrome", "Excel", "Stripe", "Zoom"],
    topTasks: ["Ticket triage", "Payment reconciliation", "Customer replies", "Queue coverage"],
  },
  narrative: shiftNarrative,
  timeline: [
    { time: "08:02", title: "Clocked in", detail: "Started on time, two minutes before the scheduled 08:00 handover." },
    { time: "08:05–09:20", title: "Support queue cleared", detail: "Four customer replies sent, two billing escalations tagged, refund policy referenced." },
    { time: "10:00–11:30", title: "Payment reconciliation", detail: "28 rows matched against the Shopify export; three discrepancies logged in the spreadsheet." },
    { time: "12:00", title: "Extended lunch", detail: "Activity fell to 21 active minutes against a scheduled 60, consistent with a longer break." },
    { time: "13:00–14:30", title: "Stand-up and queue coverage", detail: "Shared the reconciliation file on Zoom, captured notes, returned to Zendesk afterwards." },
    { time: "16:04", title: "Clocked out", detail: "Closed the shift with 7h 10m worked, 52m breaks and 12m overtime." },
  ],
  recommendations: [
    {
      title: "Agree a visible return-from-break routine",
      detail: "Set a shared expectation for the lunch window and check the next two weeks for a repeat before treating it as a pattern.",
      priority: "medium",
    },
    {
      title: "Reinforce the early reconciliation completion",
      detail: "Name the ahead-of-stand-up delivery explicitly in the next check-in so the behaviour is repeated.",
      priority: "low",
    },
    {
      title: "Spot-check the 14:00 window",
      detail: "Review the queue lull around 14:00 and agree what work fills it, rather than leaving it to ad-hoc browsing.",
      priority: "medium",
    },
  ],
  charts: {
    bar: { title: "Active minutes per hour", unit: "min", series: hourlyActivity.map((b) => ({ label: b.hour, value: b.activeMinutes })) },
    pie: {
      title: "Shift time allocation",
      unit: "min",
      segments: [
        { label: "Worked", value: 430 },
        { label: "Breaks", value: 52 },
        { label: "Overtime", value: 12 },
        { label: "Missed time", value: 46 },
      ],
    },
  },
  screenActivity: {
    status: "completed",
    overview:
      "08:05–09:20: Zendesk queue and refund policy. 10:00–11:30: reconciliation spreadsheet and payment dashboard. 13:00–14:30: support queue mixed with a Zoom stand-up.",
    blocks: screenBlocks,
    coverage: { captures: 8, uniqueFrames: 6, blocks: 3, visionCalls: 3 },
  },
  generatedAt: new Date().toISOString(),
});

const analysisWorkers = [AGENT, AGENT2].map((user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
}));

const workerShifts = Array.from({ length: 5 }, (_, i) => ({
  shiftId: `f000shift0000000000000000${i + 1}`,
  workDate: dayKey(-i),
  clockInTime: `${dayKey(-i)}T08:02:00.000Z`,
  clockOutTime: `${dayKey(-i)}T16:04:00.000Z`,
  attendanceStatus: i === 4 ? "late" : "on_time",
  closureReason: "manual",
  kpiScore: 87 - i * 4,
  analysis: { status: "completed", source: "ai", generatedAt: new Date().toISOString() },
}));

const aggregateRows = [
  {
    userId: AGENT._id,
    name: AGENT.name,
    email: AGENT.email,
    shiftCount: 18,
    absentCount: 0,
    averageScore: 86,
    averageAdherence: 91,
    workedMinutes: 7560,
    scheduledMinutes: 9160,
    breakMinutes: 940,
    overtimeMinutes: 96,
    lateShifts: 1,
    lateMinutes: 8,
    averagePunctuality: 97,
    averageWorkedMinutes: 420,
    screenShifts: 16,
    screenBlocks: 44,
    focusedBlocks: 31,
    idleBlocks: 4,
    bestDate: dayKey(-6),
    bestScore: 94,
    worstDate: dayKey(-17),
    worstScore: 71,
    firstDate: dayKey(-27),
    lastDate: dayKey(-1),
    scoreSpread: 23,
  },
  {
    userId: AGENT2._id,
    name: AGENT2.name,
    email: AGENT2.email,
    shiftCount: 15,
    absentCount: 2,
    averageScore: 72,
    averageAdherence: 74,
    workedMinutes: 5120,
    scheduledMinutes: 7620,
    breakMinutes: 720,
    overtimeMinutes: 24,
    lateShifts: 3,
    lateMinutes: 41,
    averagePunctuality: 78,
    averageWorkedMinutes: 341,
    screenShifts: 11,
    screenBlocks: 28,
    focusedBlocks: 14,
    idleBlocks: 9,
    bestDate: dayKey(-9),
    bestScore: 86,
    worstDate: dayKey(-22),
    worstScore: 51,
    firstDate: dayKey(-26),
    lastDate: dayKey(-2),
    scoreSpread: 35,
  },
];

const aggregateNarrative = {
  headline: "Eighteen delivered shifts with one worker pulling ahead and one needing support",
  summary:
    "Across the period the team completed 33 analysed shifts, averaging 79% overall performance and 83% schedule adherence. Ada Okafor's 18 shifts averaged 86% with a single late start, while Liam Chen's 15 shifts averaged 72% with two absences and three late starts. The screen evidence covers 72 narrated windows and supports the gap between the two profiles rather than merely repeating it.",
  executiveSummary:
    "The period covers 28 calendar days and 33 analysed shifts across two assigned workers. Performance is stable at the team level but uneven underneath: Ada Okafor averaged 86% across 18 shifts and Liam Chen 72% across 15, a 14-point gap that is consistent across weeks rather than driven by a single bad day.\n\nTime is the clearest differentiator. Ada recorded 7,560 worked minutes against 9,160 scheduled, with 96 minutes of overtime and a single eight-minute late start. Liam recorded 5,120 minutes against 7,620 scheduled, with two absences and 41 minutes of lateness across three shifts. The utilisation gap — 83% against 67% — explains most of the difference in the average score before any judgement about capability.\n\nThe screenshot story follows the numbers. Ada's narrated windows are dominated by Zendesk, the reconciliation spreadsheet and the payment dashboard, with 31 of 44 windows reading as focused work. Liam's windows show a similar tool set but far more idle and mixed time, and nine of 28 windows read as idle — several around the late-start shifts, where the first captured window lands well after the scheduled start.\n\nAttendance discipline is the second theme. Ada's only lateness is a single eight-minute start; Liam's three late starts cluster in the second week and coincide with the two absences, which is the pattern most worth a conversation.\n\nNeither worker shows a compliance problem in the screen evidence: no credentials, customer personal data or unexpected applications appear in any captured window. The risks in this period are reliability and consistency, not conduct.\n\nThe overall picture is a team that is delivering while carrying an uneven load, with one worker who should be left to work and one who needs a structured, specific plan for the next four weeks.",
  verdict:
    "Continue Ada Okafor's assignment unchanged and put a four-week improvement plan around Liam Chen's attendance and start-of-day reliability. The screen evidence supports both conclusions.",
  highlights: [
    "33 analysed shifts completed across the period, with 79% average overall performance.",
    "Ada Okafor averaged 86% across 18 shifts with a single late start.",
    "72 screen windows were narrated from stored screenshots, supporting the narrative with evidence.",
    "No compliance issues were recorded in any captured window.",
  ],
  concerns: [
    "Liam Chen averaged 72% with two absences and three late starts, all clustered in week two.",
    "Utilisation for Liam was 67% against Ada's 83%, driven by late starts and idle windows.",
    "Nine of Liam's 28 narrated windows read as idle, which warrants a schedule review rather than a conduct process.",
  ],
  sections: {
    performance:
      "Team performance averaged 79% across 33 analysed shifts, with a median of 84% and a spread from 51% to 94%. The distribution is bimodal rather than noisy: Ada's shifts cluster between 80% and 94%, while Liam's cluster between 51% and 86% with several at the lower end.\n\nAda Okafor completed 18 shifts at 86% average adherence of 91%, with a best shift of 94% and a weakest of 71%. The weaker shifts are concentrated in the week where the support queue spiked, which points to load rather than capability.\n\nLiam Chen completed 15 shifts at 72%, with adherence at 74% and a range from 51% to 86%. The lower scores track the late starts and absences: the two shifts following an absence both scored below 60%, which is the clearest single pattern in the data.\n\nTaken together, the team is delivering. The 14-point gap between the two workers is the most important number in this report because it is stable, explainable and, in Liam's case, addressable with a specific plan.",
    attendance:
      "Across 33 shifts the team recorded 24 on-time starts, 4 late starts, 2 very late starts, 2 absences and 1 overtime shift. Utilisation was 78% overall, with 1,660 break minutes and 120 overtime minutes across the period.\n\nAda's attendance is the strongest in the dataset: 17 on-time starts from 18 shifts, one eight-minute lateness and no absences. Her overtime is 96 minutes across 18 shifts, which is within tolerance.\n\nLiam's attendance is the focus of this report: two absences and three late starts, all concentrated in a single week, plus 24 minutes of overtime. The clustering matters. A single late start is noise; three in one week alongside two absences is a reliability signal that should be addressed directly and early.",
    screenStory:
      "The screen evidence begins in the first week with Ada clearing the overnight support queue: Zendesk tickets, the refund policy document and the payment provider dashboard recur across the early windows. The reconciliation spreadsheet appears every Tuesday and Thursday, which matches the rota.\n\nBy the second week the evidence shows Liam's windows starting later than the scheduled start, with the first captured frame often showing the desktop or a chat application rather than the queue. The idle windows cluster around those mornings. In the same week, Ada's windows continue to show queue and reconciliation work with two mixed windows during stand-ups.\n\nThe third week is the most consistent for both workers: the queue and the reconciliation file dominate, with two Zoom stand-ups and a training session appearing in the narration. Liam's windows improve as the week progresses, which suggests the attendance issue was episodic rather than a sustained change.\n\nThe final week returns to the established pattern: Ada focused on queue and reconciliation with 55 active minutes at the peak hour, Liam mixing queue work with longer idle windows. Across the period the dominant applications are Zendesk, Chrome, Excel, Stripe and Zoom — exactly the tool set the rota assumes.\n\nIn total, 72 windows were narrated from stored screenshots: 45 read as focused, 18 as mixed and 9 as idle. The idle share is carried almost entirely by Liam's late-start mornings.",
    patterns:
      "Work concentrates between 09:00 and 15:00, with peak activity at 11:00 across the period and a consistent dip between 12:00 and 13:00 for the lunch window. The longest inactive gap recorded for any single shift was 60 minutes, which aligns with the scheduled lunch rather than unrecorded absence.\n\nWeek by week, the team average moved from 81% in week one to 76% in week two, recovered to 84% in week three and held at 82% in week four. The week-two dip is entirely attributable to Liam's absences and late starts.\n\nTask mix is stable: ticket triage, payment reconciliation and queue coverage account for most narrated tasks, with stand-up and meeting notes appearing in the mixed windows. There is no evidence of a task-type shift that would explain the performance gap.",
    risks:
      "The dominant risk is reliability, not conduct. Liam's two absences and three late starts cluster in one week, which is the classic shape of a temporary personal disruption rather than disengagement; it still needs a direct conversation before it becomes a habit.\n\nThe second risk is coverage. On the two days Liam was absent, the queue was carried by Ada alone, and the narration shows her working through the overnight backlog in both cases. That is acceptable for a short period but not for a month.\n\nNo compliance risks were observed. No credentials, card numbers, customer personal data or unexpected applications appear in any captured window, and no captured window shows a screen that the rota would not expect.",
    recommendations:
      "For Ada Okafor: continue the current assignment unchanged, keep the weekly check-in, and share the reconciliation completion record as a positive example in team communications.\n\nFor Liam Chen: put a four-week improvement plan in place covering attendance reliability, start-of-day routine and idle-window reporting. Review at the end of week two rather than week four, because the pattern is recent and still tractable.\n\nFor the hiring manager: decide now what happens to coverage if Liam's absences continue. A single named backup for the queue is cheaper than discovering the gap during a busy week.\n\nFor the reporting process: keep the screenshot narration cadence unchanged. The evidence quality in this period is what makes the difference between the two workers legible and defensible.",
    outlook:
      "The next period should be judged on three things: Liam's return to a stable start time, the team's utilisation holding above 75%, and whether the average score stays above 78% without Ada carrying additional load.\n\nIf Liam's attendance stabilises in the first two weeks, the team is in good shape and this report becomes the baseline. If it does not, the next report should be read alongside the attendance policy rather than the performance narrative.",
  },
  workerNotes: [
    {
      name: "Ada Okafor",
      summary:
        "Ada completed 18 shifts at 86% average with 91% adherence and a single eight-minute late start. Her utilisation of 83% is the strongest in the period, and the screen evidence shows a consistent tool set: Zendesk, the reconciliation spreadsheet and the payment dashboard. The weak shift of 71% falls in the week the queue spiked, and the narration for that day shows her clearing backlog rather than disengaging. She is dependable and should be left to work.",
      strengths: [
        "18 shifts at 86% average with 91% adherence.",
        "31 of 44 narrated windows read as focused work.",
        "Cleared the overnight backlog on both days a colleague was absent.",
      ],
      watchouts: ["One eight-minute late start; no pattern.", "96 minutes of overtime across the period, within tolerance."],
      recommendation: "Continue the assignment unchanged and keep the weekly check-in.",
    },
    {
      name: "Liam Chen",
      summary:
        "Liam completed 15 shifts at 72% with 74% adherence, two absences and three late starts clustered in a single week. Utilisation was 67% against Ada's 83%, and nine of his 28 narrated windows read as idle, several of them on the late-start mornings. The tool set matches the rota, so the gap is about presence and start-of-day routine rather than capability. The pattern is recent and still tractable.",
      strengths: [
        "Best shift of 86% shows the ceiling is high.",
        "Tool set matches the rota with no unexpected applications.",
        "Screen evidence improves through week three.",
      ],
      watchouts: [
        "Two absences and three late starts in one week.",
        "67% utilisation, the lowest in the period.",
        "Nine idle windows clustered on late-start mornings.",
      ],
      recommendation: "Four-week improvement plan with a review at the end of week two.",
    },
  ],
};

const aggregateStory = [
  { date: dayKey(-26), at: `${dayKey(-26)}T08:06:00.000Z`, label: "08:06–09:30", worker: AGENT.name, summary: "Opened the overnight Zendesk queue and cleared nine tickets before the morning stand-up, with the refund policy open alongside.", apps: ["Zendesk", "Chrome"], tasks: ["Ticket triage"], activity: "focused", confidence: 88, captureId: captureId(0), capturedAt: `${dayKey(-26)}T08:12:00.000Z`, shiftId: "f000shift00000000000000001" },
  { date: dayKey(-22), at: `${dayKey(-22)}T09:40:00.000Z`, label: "09:40–11:05", worker: AGENT2.name, summary: "First captured window of the day lands after the scheduled start; the desktop and a chat thread are visible before the queue is opened.", apps: ["Chrome", "Slack"], tasks: ["Queue coverage"], activity: "idle", confidence: 74, captureId: captureId(1), capturedAt: `${dayKey(-22)}T09:42:00.000Z`, shiftId: "f000shift00000000000000003" },
  { date: dayKey(-17), at: `${dayKey(-17)}T10:02:00.000Z`, label: "10:02–11:28", worker: AGENT.name, summary: "Reconciliation spreadsheet and Stripe dashboard side by side; 28 payment rows matched and three mismatches highlighted.", apps: ["Excel", "Stripe"], tasks: ["Payment reconciliation"], activity: "focused", confidence: 86, captureId: captureId(2), capturedAt: `${dayKey(-17)}T10:12:00.000Z`, shiftId: "f000shift00000000000000005" },
  { date: dayKey(-14), at: `${dayKey(-14)}T13:10:00.000Z`, label: "13:10–14:20", worker: AGENT2.name, summary: "Queue work mixed with a video call; the notes document stays open across the window and two social feeds appear between tickets.", apps: ["Zoom", "Notion", "Chrome"], tasks: ["Stand-up", "Queue coverage"], activity: "mixed", confidence: 71, captureId: captureId(3), capturedAt: `${dayKey(-14)}T13:12:00.000Z`, shiftId: "f000shift00000000000000007" },
  { date: dayKey(-9), at: `${dayKey(-9)}T09:15:00.000Z`, label: "09:15–10:40", worker: AGENT.name, summary: "Support queue and refund policy document; four customer replies sent and two billing escalations tagged for the team lead.", apps: ["Zendesk", "Google Docs"], tasks: ["Customer replies", "Escalation"], activity: "focused", confidence: 90, captureId: captureId(4), capturedAt: `${dayKey(-9)}T09:18:00.000Z`, shiftId: "f000shift00000000000000009" },
  { date: dayKey(-4), at: `${dayKey(-4)}T14:05:00.000Z`, label: "14:05–15:30", worker: AGENT2.name, summary: "Queue work resumes after a long idle window; tickets are answered quickly but the reconciliation follow-ups are still open at the end of the shift.", apps: ["Zendesk"], tasks: ["Queue coverage"], activity: "focused", confidence: 76, captureId: captureId(5), capturedAt: `${dayKey(-4)}T14:12:00.000Z`, shiftId: "f000shift00000000000000011" },
];

const aggregatePayload = (start, end, userId) => {
  const rows = userId ? aggregateRows.filter((row) => row.userId === userId) : aggregateRows;
  const totals = {
    workers: rows.length,
    analyses: rows.reduce((sum, row) => sum + row.shiftCount, 0),
    averageScore: Math.round(rows.reduce((sum, row) => sum + row.averageScore * row.shiftCount, 0) / rows.reduce((sum, row) => sum + row.shiftCount, 0)),
    averageAdherence: Math.round(rows.reduce((sum, row) => sum + row.averageAdherence * row.shiftCount, 0) / rows.reduce((sum, row) => sum + row.shiftCount, 0)),
    workedMinutes: rows.reduce((sum, row) => sum + row.workedMinutes, 0),
    scheduledMinutes: rows.reduce((sum, row) => sum + row.scheduledMinutes, 0),
    absentCount: rows.reduce((sum, row) => sum + row.absentCount, 0),
    lateShifts: rows.reduce((sum, row) => sum + row.lateShifts, 0),
    lateMinutes: rows.reduce((sum, row) => sum + row.lateMinutes, 0),
    overtimeMinutes: rows.reduce((sum, row) => sum + row.overtimeMinutes, 0),
    breakMinutes: rows.reduce((sum, row) => sum + row.breakMinutes, 0),
  };

  const period = {
    dayCount: 28,
    recordedDays: 24,
    attendance: { onTime: 24, late: 4, veryLate: 2, absent: 2, overtime: 1 },
    closures: [{ label: "manual", count: 30 }, { label: "auto_closed", count: 2 }, { label: "missed_shift", count: 1 }],
    hourlyActivity: [
      { hour: "08:00", activeMinutes: 96 },
      { hour: "09:00", activeMinutes: 218 },
      { hour: "10:00", activeMinutes: 241 },
      { hour: "11:00", activeMinutes: 262 },
      { hour: "12:00", activeMinutes: 84 },
      { hour: "13:00", activeMinutes: 198 },
      { hour: "14:00", activeMinutes: 236 },
      { hour: "15:00", activeMinutes: 171 },
      { hour: "16:00", activeMinutes: 64 },
    ],
    weeklyTrend: [
      { label: "2026-10-12", shifts: 9, averageScore: 81, workedMinutes: 3520 },
      { label: "2026-10-19", shifts: 8, averageScore: 76, workedMinutes: 3010 },
      { label: "2026-10-26", shifts: 9, averageScore: 84, workedMinutes: 3640 },
      { label: "2026-11-02", shifts: 7, averageScore: 82, workedMinutes: 2510 },
    ],
    topApps: [
      { name: "Zendesk", count: 34 },
      { name: "Chrome", count: 29 },
      { name: "Excel", count: 18 },
      { name: "Stripe", count: 12 },
      { name: "Zoom", count: 8 },
      { name: "Notion", count: 6 },
    ],
    topTasks: [
      { name: "Ticket triage", count: 26 },
      { name: "Payment reconciliation", count: 17 },
      { name: "Customer replies", count: 14 },
      { name: "Queue coverage", count: 11 },
      { name: "Stand-up", count: 6 },
    ],
    screen: { screenshots: 412, narratedShifts: 27, blocks: 72, focused: 45, mixed: 18, idle: 9 },
    utilisationPercent: 78,
    presencePercent: 94,
  };

  const story = userId ? aggregateStory.filter((beat) => beat.worker === (rows[0] && rows[0].name)) : aggregateStory;

  return {
    startDate: start,
    endDate: end,
    targetUserId: userId || null,
    totals,
    rows,
    period,
    story,
    captures: story
      .filter((beat) => beat.captureId)
      .map((beat) => ({
        captureId: beat.captureId,
        capturedAt: beat.capturedAt,
        worker: beat.worker,
        date: beat.date,
        note: beat.summary,
        shiftId: beat.shiftId,
      })),
    shifts: Array.from({ length: 33 }, (_, i) => {
      const row = i % 3 === 0 ? rows[rows.length - 1] : rows[0];
      return {
        shiftId: `f000shift${String(i).padStart(17, "0")}`,
        date: dayKey(-(i + 1)),
        worker: row.name,
        userId: row.userId,
        score: 88 - (i % 20),
        adherence: 92 - (i % 15),
        attendance: i % 11 === 0 ? "late" : i % 17 === 0 ? "absent" : "on_time",
        closure: i % 13 === 0 ? "auto_closed" : "manual",
        workedMinutes: 430 - (i % 60),
        scheduledMinutes: 540,
        breakMinutes: 50,
        overtimeMinutes: i % 9 === 0 ? 12 : 0,
        lateMinutes: i % 11 === 0 ? 7 : 0,
        activePercent: 78 - (i % 14),
        screenshots: 8 + (i % 6),
        screenBlocks: 3 + (i % 2),
        headline: "Queue cleared and reconciliation completed",
      };
    }),
    narrative: {
      _id: "period0000000000000001",
      rangeStart: start,
      rangeEnd: end,
      scopeKey: "admin:all",
      totals,
      narrative: aggregateNarrative,
      status: "completed",
      source: "ai",
      generatedAt: new Date().toISOString(),
      error: null,
    },
  };
};


const json = (res, code, body) => {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  });
  res.end(data);
};

const userByToken = (token) => {
  if (!token) return null;
  if (token.startsWith("mock-admin")) return ADMIN;
  if (token.startsWith("mock-manager")) return MANAGER;
  return AGENT;
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  const me = userByToken(auth) || ADMIN;

  if (req.method === "OPTIONS") return json(res, 204, {});

  if (path === "/api/auth/login" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const email = (JSON.parse(body || "{}").email || "").toLowerCase();
      if (email.startsWith("admin")) return json(res, 200, { token: "mock-admin-token", user: ADMIN });
      if (email.startsWith("manager")) return json(res, 200, { token: "mock-manager-token", user: MANAGER });
      return json(res, 200, { token: "mock-agent-token", user: AGENT });
    });
    return;
  }

  if (path === "/api/auth/me") return json(res, 200, me);
  if (path === "/api/auth/users") {
    return json(res, 200, [ADMIN, MANAGER, AGENT, AGENT2, { ...AGENT, _id: "a005agent0000000000000003", name: "Priya Nair", email: "priya@demo.test", accountStatus: "approved" }]);
  }
  if (path === "/api/attendance/shift/active") {
    return json(res, 200, me.role === "agent" ? activeShift : null);
  }
  if (path === "/api/execution/me/daily") return json(res, 200, dailyPerformance);
  if (path === "/api/attendance/shift/f000shift00000000000000001/events") return json(res, 200, events);
  if (path === "/api/scheduling/schedule/me") return json(res, 200, agentSchedules);
  if (path === "/api/scheduling/templates") return json(res, 200, [TIME_TEMPLATE, FLUID_TEMPLATE, SHORT_TEMPLATE]);
  if (path === "/api/scheduling/schedule") {
    if (req.method === "DELETE") return json(res, 200, { deletedCount: 1 });
    if (req.method === "POST") return json(res, 201, [agentSchedules[0]]);
    return json(res, 200, [...agentSchedules, { ...agentSchedules[0], _id: "s999", userId: AGENT2._id, shiftTemplateId: SHORT_TEMPLATE }]);
  }
  if (path === "/api/execution/admin/overview") return json(res, 200, overview);
  if (path.startsWith("/api/execution/admin/report")) {
    const start = url.searchParams.get("startDate") || dayKey(0);
    const end = url.searchParams.get("endDate") || dayKey(0);
    const rows = [];
    for (let offset = 0; offset < 7; offset += 1) {
      for (const agent of [AGENT, AGENT2]) {
        rows.push({
          date: `${dayKey(-offset)}T00:00:00.000Z`,
          user: agent,
          performance: {
            ...dailyPerformance,
            overallScore: 60 + ((offset * 13 + agent._id.length * 7) % 35),
            adherenceScore: 55 + ((offset * 9 + agent._id.length * 5) % 40),
            workedMinutes: 420 - offset * 35,
            scheduledMinutes: 480,
            breakMinutes: 45 - offset * 3,
          },
        });
      }
    }
    return json(res, 200, {
      startDate: `${start}T00:00:00.000Z`,
      endDate: `${end}T00:00:00.000Z`,
      totals: { records: rows.length, users: 2, scheduledMinutes: rows.length * 480, workedMinutes: rows.length * 380, breakMinutes: rows.length * 40, lateMinutes: 12, overtimeMinutes: 30, averageAdherence: 78, averagePerformance: 81 },
      rows,
    });
  }
  // --- AI Analysis & Summary ------------------------------------------------
  if (path === "/api/analysis/overview") {
    return json(res, 200, { totalAnalyses: 33, averageScore: 79, aiAnalyses: 33, recentAnalyses: 7 });
  }
  if (path === "/api/analysis/workers") return json(res, 200, analysisWorkers);
  if (/^\/api\/analysis\/workers\/[^/]+\/shifts$/.test(path)) return json(res, 200, workerShifts);
  if (/^\/api\/analysis\/shift\/[^/]+\/generate$/.test(path) && req.method === "POST") {
    return json(res, 200, shiftAnalysisPayload());
  }
  if (/^\/api\/analysis\/shift\/[^/]+\/activity$/.test(path)) {
    const payload = shiftAnalysisPayload();
    return json(res, 200, {
      status: "completed",
      overview: payload.screenActivity.overview,
      blocks: payload.screenActivity.blocks,
      coverage: payload.screenActivity.coverage,
      source: "ai",
    });
  }
  if (/^\/api\/analysis\/shift\/[^/]+$/.test(path)) return json(res, 200, shiftAnalysisPayload());
  if (path === "/api/analysis/aggregate/narrative" && req.method === "POST") {
    const payload = aggregatePayload(dayKey(-27), dayKey(0), "");
    return json(res, 200, payload.narrative);
  }
  if (path === "/api/analysis/aggregate") {
    const start = url.searchParams.get("startDate") || dayKey(-27);
    const end = url.searchParams.get("endDate") || dayKey(0);
    const userId = url.searchParams.get("userId") || "";
    return json(res, 200, aggregatePayload(start, end, userId));
  }

  if (path === "/api/leave") return json(res, 200, [
    { _id: "l1", userId: AGENT._id, leaveType: "annual", startDate: `${dayKey(10)}T00:00:00.000Z`, endDate: `${dayKey(12)}T00:00:00.000Z`, reason: "Family trip", status: "pending" },
    { _id: "l2", userId: AGENT2._id, leaveType: "sick", startDate: `${dayKey(-2)}T00:00:00.000Z`, endDate: `${dayKey(-1)}T00:00:00.000Z`, reason: "Flu", status: "approved" },
  ]);
  if (path === "/api/leave/me") return json(res, 200, [
    { _id: "l3", userId: AGENT._id, leaveType: "personal", startDate: `${dayKey(20)}T00:00:00.000Z`, endDate: `${dayKey(20)}T00:00:00.000Z`, reason: "Appointment", status: "approved" },
  ]);
  if (path === "/api/chat/recipients") return json(res, 200, me.role === "agent" ? [MANAGER, ADMIN] : [AGENT, AGENT2, ADMIN]);
  if (path === "/api/chat/conversations") return json(res, 200, [
    { _id: "conv1", participants: [me, AGENT], otherParticipant: me.role === "agent" ? MANAGER : AGENT, lastMessage: "Sounds good, see you tomorrow.", lastMessageAt: `${dayKey(0)}T09:12:00.000Z`, unreadCount: 2 },
  ]);
  if (path.startsWith("/api/chat/conversations/conv1/messages")) return json(res, 200, [
    { _id: "m1", conversationId: "conv1", senderId: me.role === "agent" ? MANAGER : AGENT, body: "Hey, how is the shift going?", readBy: [], createdAt: `${dayKey(0)}T09:10:00.000Z` },
    { _id: "m2", conversationId: "conv1", senderId: me, body: "Sounds good, see you tomorrow.", readBy: [], createdAt: `${dayKey(0)}T09:12:00.000Z` },
  ]);
  if (path.startsWith("/api/chat/conversations")) return json(res, 200, { _id: "conv2", participants: [me], otherParticipant: ADMIN, unreadCount: 0 });
  if (path === "/api/chat/messages") return json(res, 200, { _id: "m3", conversationId: "conv1", senderId: me, body: "sent", readBy: [], createdAt: new Date().toISOString() });

  if (path.startsWith("/api/monitoring/user/a001agent0000000000000001/shifts")) {
    return json(res, 200, [monitoringSummary("ms1", 1, 6, "completed"), monitoringSummary("ms2", 2, 8, "completed"), monitoringSummary("ms3", 0, 2, "active")]);
  }
  if (path.startsWith("/api/monitoring/shift/")) {
    return json(res, 200, captureDetail(6));
  }
  if (path.startsWith("/api/monitoring/captures/")) {
    res.writeHead(200, { "Content-Type": "image/jpeg", "Access-Control-Allow-Origin": "*" });
    return res.end(PIXEL_JPEG);
  }
  if (path.startsWith("/api/monitoring/session/")) {
    if (path.endsWith("/capture")) return json(res, 201, { seq: 1, capturedAt: new Date().toISOString(), captureCount: 1, capturePlan: 8 });
    return json(res, 201, { monitoringSessionId: "m1", capturePlan: 8, captures: 0, startedAt: new Date().toISOString() });
  }

  json(res, 404, { message: `Mock has no handler for ${req.method} ${path}` });
});

server.on("upgrade", (req, socket) => {
  socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
  socket.destroy();
});

server.listen(PORT, () => console.log(`Mock WFM backend listening on http://127.0.0.1:${PORT}`));
