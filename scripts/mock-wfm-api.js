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
