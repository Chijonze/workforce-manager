import http from "http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import User from "../models/User";
import ShiftEvent from "../models/ShiftEvent";
import ShiftSession from "../models/ShiftSession";
import { combineDateAndTime, getBusinessDateKey } from "../utils/scheduleTime";
import {
  addCapture,
  addMouseSamples,
  getDesktopMonitoringHandoff,
  markDesktopAgentActive,
} from "../modules/monitoring/monitoring.service";
import { registerAgentNotifier } from "../modules/monitoring/monitoringAgentBus";

type ClientType = "employee" | "admin";

type ScreenClient = {
  id: string;
  type: ClientType;
  socket: WebSocket;
  isAlive: boolean;
  authUserId?: string;
  authRole?: "admin" | "supervisor";
  assignedEmployees?: MonitorEmployee[];
  watchingId?: string;
  allowedEmployeeIds?: Set<string> | null;
  userId?: string;
  monitoringCaptureMeta?: { shiftId: string; width: number; height: number };
};

type EmployeeActivityState =
  | "available"
  | "break"
  | "lunch"
  | "meeting"
  | "training"
  | "after_call_work"
  | "ended_shift"
  | "not_clocked_in";

type EmployeeActivity = {
  state: EmployeeActivityState;
  label: string;
  since?: string;
};

type MonitorEmployee = {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  activeMonitorId?: string;
  activity?: EmployeeActivity | null;
};

type PresenceMessage = {
  type: "presence";
  employees: string[];
  assignedEmployees?: MonitorEmployee[];
};

const employees = new Map<string, ScreenClient>();
const admins = new Set<ScreenClient>();

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function normalizeMonitorId(id: string) {
  return id.trim().toLowerCase();
}

function normalizeMonitorKey(id: string) {
  return normalizeMonitorId(id).replace(/[^a-z0-9]/g, "");
}

const numberWordAliases: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

function replaceNumberWords(id: string) {
  return normalizeMonitorId(id).replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
    (word) => numberWordAliases[word] || word
  );
}

function normalizeNumberPadding(id: string) {
  return id.replace(/\d+/g, (digits) => String(Number(digits)));
}

function getMonitorAliases(id: string, includeAgentNumberAlias = false): string[] {
  const normalized = normalizeMonitorId(id);
  const numberWordsReplaced = replaceNumberWords(id);
  const compact = normalizeMonitorKey(numberWordsReplaced);
  const compactWithoutNumberPadding = normalizeNumberPadding(compact);
  const trailingNumber = includeAgentNumberAlias
    ? compactWithoutNumberPadding.match(/(\d+)$/)?.[1]
    : "";

  return [...new Set([
    normalized,
    numberWordsReplaced,
    normalizeMonitorKey(normalized),
    compact,
    compactWithoutNumberPadding,
    trailingNumber,
    trailingNumber ? `agent${trailingNumber}` : "",
  ].filter((alias): alias is string => Boolean(alias)))];
}

function getAgentMonitorIds(agent: any) {
  const id = String(agent?._id || "");
  const name = String(agent?.name || "");
  const email = String(agent?.email || "");
  const monitorId = String(agent?.monitorId || "");
  const emailLocalPart = email.includes("@") ? email.split("@")[0] : "";

  return [
    ...getMonitorAliases(id),
    ...getMonitorAliases(monitorId, true),
    ...getMonitorAliases(email, true),
    ...getMonitorAliases(emailLocalPart, true),
    ...getMonitorAliases(name, true),
  ];
}

function monitorIdMatchesAgent(monitorId: string, agent: any) {
  const aliases = getMonitorAliases(monitorId, true);
  const agentMonitorIds = new Set(getAgentMonitorIds(agent));

  return aliases.some((alias) => agentMonitorIds.has(alias));
}

function sendJson(socket: WebSocket, value: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(safeJson(value));
  }
}

function getVisibleEmployeeIds(admin: ScreenClient) {
  const employeeIds = [...employees.keys()];
  const allowed = admin.allowedEmployeeIds;

  return (
    allowed
      ? employeeIds.filter((employeeId) =>
          getMonitorAliases(employeeId, true).some((alias) => allowed.has(alias))
        )
      : employeeIds
  ).sort((a, b) => a.localeCompare(b));
}

function findEmployeeByMonitorId(id: string) {
  const aliases = getMonitorAliases(id, true);

  return [...employees.values()].find(
    (employee) => getMonitorAliases(employee.id, true).some((alias) => aliases.includes(alias))
  );
}

function findEmployeeForAgent(agent: any) {
  const agentId = String(agent?._id || "");

  return [...employees.values()].find(
    (employee) => employee.userId === agentId || monitorIdMatchesAgent(employee.id, agent)
  );
}

async function findAssignedAgentForTarget(admin: ScreenClient, targetId: string) {
  if (admin.authRole !== "supervisor" || !admin.authUserId) return null;

  const user = await User.findById(admin.authUserId)
    .select("assignedAgentIds")
    .populate("assignedAgentIds", "_id name email monitorId")
    .lean();

  const targetAliases = getMonitorAliases(targetId, true);

  return ((user?.assignedAgentIds || []) as any[]).find((agent) => {
    const agentId = String(agent?._id || "");

    return (
      agentId === targetId ||
      targetAliases.some((alias) => getAgentMonitorIds(agent).includes(alias))
    );
  }) || null;
}

function findActiveMonitorId(monitorIds: string[]) {
  return monitorIds
    .map((id) => findEmployeeByMonitorId(id)?.id)
    .find(Boolean);
}

// Worker activity (available / on break / ended shift, ...) is derived from
// shift sessions and events, not from the desktop-agent socket, so the two
// truths stay independent: a worker can be online and on break at once.
const AVAILABLE_ACTIVITY: EmployeeActivity = { state: "available", label: "Available" };
const NOT_CLOCKED_IN_ACTIVITY: EmployeeActivity = { state: "not_clocked_in", label: "Not clocked in" };

const ACTIVITY_FROM_EVENT: Record<string, EmployeeActivity> = {
  SHIFT_START: AVAILABLE_ACTIVITY,
  WORK_START: AVAILABLE_ACTIVITY,
  BREAK_END: AVAILABLE_ACTIVITY,
  LUNCH_END: AVAILABLE_ACTIVITY,
  MEETING_END: AVAILABLE_ACTIVITY,
  TRAINING_END: AVAILABLE_ACTIVITY,
  AFTER_CALL_WORK_END: AVAILABLE_ACTIVITY,
  BREAK_START: { state: "break", label: "On break" },
  LUNCH_START: { state: "lunch", label: "On lunch" },
  MEETING_START: { state: "meeting", label: "In a meeting" },
  TRAINING_START: { state: "training", label: "In training" },
  AFTER_CALL_WORK_START: { state: "after_call_work", label: "After-call work" },
  SHIFT_END: { state: "ended_shift", label: "Ended shift" },
};

const PRESENCE_CACHE_TTL_MS = 10000;

type PresenceCacheEntry<T> = { at: number; value: T };

let agentsCache: PresenceCacheEntry<any[]> | null = null;
let activityCache: PresenceCacheEntry<Map<string, EmployeeActivity>> | null = null;

function getFreshCache<T>(cache: PresenceCacheEntry<T> | null): T | null {
  return cache && Date.now() - cache.at < PRESENCE_CACHE_TTL_MS ? cache.value : null;
}

async function getAgentsSnapshot() {
  const cached = getFreshCache(agentsCache);
  if (cached) return cached;

  const agents = await User.find({ role: "agent" })
    .select("_id name email monitorId")
    .lean();
  agentsCache = { at: Date.now(), value: agents };
  return agents;
}

async function loadAgentActivity(): Promise<Map<string, EmployeeActivity>> {
  const agents = await getAgentsSnapshot();
  const userIds = agents.map((agent) => String(agent._id));
  const activityByUserId = new Map<string, EmployeeActivity>();
  if (!userIds.length) return activityByUserId;

  const businessDayStart = combineDateAndTime(getBusinessDateKey(new Date()), "00:00");

  const activeShifts = await ShiftSession.find({ userId: { $in: userIds }, status: "active" })
    .select("_id userId")
    .lean();

  const [activeShiftLastEvents, todayLatestEvents] = await Promise.all([
    ShiftEvent.aggregate<any>([
      { $match: { shiftId: { $in: activeShifts.map((shift) => shift._id) } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: "$shiftId", type: { $first: "$type" }, timestamp: { $first: "$timestamp" } } },
    ]),
    ShiftEvent.aggregate<any>([
      { $match: { userId: { $in: userIds }, timestamp: { $gte: businessDayStart } } },
      { $sort: { timestamp: -1, _id: -1 } },
      { $group: { _id: "$userId", type: { $first: "$type" }, timestamp: { $first: "$timestamp" } } },
    ]),
  ]);

  const lastEventByShiftId = new Map(
    activeShiftLastEvents.map((event) => [String(event._id), event])
  );

  for (const shift of activeShifts) {
    const lastEvent = lastEventByShiftId.get(String(shift._id));
    const activity = (lastEvent && ACTIVITY_FROM_EVENT[lastEvent.type]) || AVAILABLE_ACTIVITY;
    activityByUserId.set(String(shift.userId), {
      ...activity,
      since: lastEvent ? new Date(lastEvent.timestamp).toISOString() : undefined,
    });
  }

  const latestEventByUserId = new Map(
    todayLatestEvents.map((event) => [String(event._id), event])
  );

  for (const userId of userIds) {
    if (activityByUserId.has(userId)) continue;

    // No active shift: an event of type SHIFT_END today means the worker
    // clocked out; anything else means they never clocked in today.
    const latest = latestEventByUserId.get(userId);
    if (latest && latest.type === "SHIFT_END") {
      activityByUserId.set(userId, {
        state: "ended_shift",
        label: "Ended shift",
        since: new Date(latest.timestamp).toISOString(),
      });
    } else {
      activityByUserId.set(userId, { ...NOT_CLOCKED_IN_ACTIVITY });
    }
  }

  activityCache = { at: Date.now(), value: activityByUserId };
  return activityByUserId;
}

async function getCachedAgentActivity(): Promise<Map<string, EmployeeActivity>> {
  const cached = getFreshCache(activityCache);
  if (cached) return cached;

  try {
    return await loadAgentActivity();
  } catch {
    // Status enrichment must never break presence; degrade to no activity.
    return new Map<string, EmployeeActivity>();
  }
}

async function refreshAllowedEmployeeIds(admin: ScreenClient) {
  if (admin.type !== "admin") return;

  const supervisorScope = admin.authRole === "supervisor" && Boolean(admin.authUserId);

  let agents: any[] = [];
  if (supervisorScope) {
    const user = await User.findById(admin.authUserId)
      .select("assignedAgentIds")
      .populate("assignedAgentIds", "_id name email monitorId")
      .lean();

    agents = (user?.assignedAgentIds || []) as any[];
    admin.allowedEmployeeIds = new Set(agents.flatMap((agent) => getAgentMonitorIds(agent)));
  } else {
    // Admins (including key-authed consoles) monitor the whole workforce.
    agents = await getAgentsSnapshot();
  }

  const activityByUserId = await getCachedAgentActivity();

  admin.assignedEmployees = agents
    .map((agent) => {
      const id = String(agent?._id || "");
      const email = String(agent?.email || "");
      const monitorIds = getAgentMonitorIds(agent);
      const activeMonitorId = findEmployeeForAgent(agent)?.id || findActiveMonitorId(monitorIds);

      return {
        id,
        name: String(agent?.name || email || id),
        email,
        isOnline: Boolean(activeMonitorId),
        activeMonitorId,
        activity: activityByUserId.get(id) || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Only supervisor-scoped watchers can have a target revoked by assignment
  // changes; admins keep full visibility regardless of this snapshot.
  if (
    supervisorScope &&
    admin.watchingId &&
    !getMonitorAliases(admin.watchingId, true).some((alias) =>
      Boolean(admin.allowedEmployeeIds?.has(alias))
    )
  ) {
    const revokedId = admin.watchingId;
    admin.watchingId = undefined;
    sendJson(admin.socket, {
      type: "stream",
      event: "employee_unavailable",
      id: revokedId,
    });
  }
}

async function sendPresence(admin: ScreenClient) {
  try {
    await refreshAllowedEmployeeIds(admin);
  } catch {
    // Keep the socket usable if assignment refresh is temporarily unavailable.
  }

  const message: PresenceMessage = {
    type: "presence",
    employees: getVisibleEmployeeIds(admin),
    assignedEmployees: admin.assignedEmployees,
  };

  sendJson(admin.socket, message);
}

function broadcastPresence() {
  for (const admin of admins) {
    void sendPresence(admin);
  }
}

function closeClient(client: ScreenClient) {
  if (client.type === "employee") {
    employees.delete(client.id);

    if (client.userId) {
      // The desktop agent went away; the browser page resumes its own
      // dashboard-scoped tracking for the rest of the shift.
      void markDesktopAgentActive(client.userId, false).catch(() => undefined);
    }

    for (const admin of admins) {
      if (admin.watchingId === client.id) {
        admin.watchingId = undefined;
        sendJson(admin.socket, {
          type: "stream",
          event: "employee_offline",
          id: client.id,
        });
      }
    }

    broadcastPresence();
    return;
  }

  admins.delete(client);
}

async function getMonitorAuth(token: string | null) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId?: string;
      mfaVerified?: boolean;
    };

    const user = await User.findById(decoded.userId)
      .select("role assignedAgentIds")
      .populate("assignedAgentIds", "_id name email monitorId")
      .lean();
    if (!user || (user.role !== "admin" && user.role !== "supervisor")) return null;
    if (user.role !== "supervisor" && decoded.mfaVerified === false) return null;

    if (user.role === "admin") {
      return { role: user.role, userId: String(decoded.userId), allowedEmployeeIds: null };
    }

    const allowedEmployeeIds = new Set(
      ((user.assignedAgentIds || []) as any[]).flatMap((agent) =>
        getAgentMonitorIds(agent)
      )
    );
    return { role: user.role, userId: String(decoded.userId), allowedEmployeeIds };
  } catch {
    return null;
  }
}

function sendToWatchingAdmins(employeeId: string, frame: Buffer) {
  for (const admin of admins) {
    if (admin.watchingId === employeeId && admin.socket.readyState === WebSocket.OPEN) {
      admin.socket.send(frame, { binary: true });
    }
  }
}

async function resolveEmployeeUserId(monitorId: string) {
  const agents = await getAgentsSnapshot();
  const agent = agents.find((candidate) => monitorIdMatchesAgent(monitorId, candidate));

  return agent ? String(agent._id) : undefined;
}

async function registerEmployee(client: ScreenClient) {
  client.userId = await resolveEmployeeUserId(client.id);
  if (client.socket.readyState !== WebSocket.OPEN) return;

  const existing = employees.get(client.id);

  if (existing && existing !== client) {
    existing.socket.close(1000, "Employee reconnected");
  }

  employees.set(client.id, client);
  broadcastPresence();

  // Desktop-wide activity monitoring handoff: if this worker has an active
  // monitored shift, the freshly connected agent takes over the remaining
  // capture plan and desktop mouse tracking. Unknown to old agent builds,
  // which simply ignore the message.
  if (client.userId) {
    try {
      const handoff = await getDesktopMonitoringHandoff(client.userId);

      if (handoff) {
        await markDesktopAgentActive(client.userId, true);
        sendJson(client.socket, { action: "START_MONITORING", ...handoff });
      }
    } catch {
      // Monitoring handoff must never disturb live streaming.
    }
  }
}

export function attachScreenMonitorServer(server: http.Server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024,
  });

  // Shift-lifecycle code (end shift, auto-close) reaches the desktop agent
  // through this notifier so it never needs to import the realtime layer.
  registerAgentNotifier((userId, payload) => {
    for (const employee of employees.values()) {
      if (employee.userId === userId) {
        sendJson(employee.socket, payload);
      }
    }
  });

  const heartbeat = setInterval(() => {
    for (const client of [...employees.values(), ...admins]) {
      if (!client.isAlive) {
        client.socket.terminate();
        closeClient(client);
        continue;
      }

      client.isAlive = false;
      client.socket.ping();
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  server.on("upgrade", async (request, socket, head) => {
    const host = request.headers.host || "localhost";
    const url = new URL(request.url || "/", `http://${host}`);

    if (url.pathname !== "/" && url.pathname !== "/screen-monitor") {
      socket.destroy();
      return;
    }

    const type = url.searchParams.get("type") as ClientType | null;
    const id = (url.searchParams.get("id") || "").trim();

    if ((type !== "employee" && type !== "admin") || !id || id.length > 120) {
      socket.destroy();
      return;
    }

    if (type === "admin") {
      const token = url.searchParams.get("token");
      const adminKey = process.env.SCREEN_MONITOR_ADMIN_KEY;
      const authorizedByKey = Boolean(adminKey && url.searchParams.get("key") === adminKey);
      const monitorAuth = await getMonitorAuth(token);

      if (!monitorAuth && !authorizedByKey) {
        socket.destroy();
        return;
      }

      (request as any).monitorAllowedEmployeeIds = authorizedByKey
        ? null
        : monitorAuth?.allowedEmployeeIds;
      (request as any).monitorAuthUserId = authorizedByKey ? undefined : monitorAuth?.userId;
      (request as any).monitorAuthRole = authorizedByKey ? "admin" : monitorAuth?.role;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const client: ScreenClient = {
        id,
        type,
        socket: ws,
        isAlive: true,
        authUserId: type === "admin" ? (request as any).monitorAuthUserId : undefined,
        authRole: type === "admin" ? (request as any).monitorAuthRole : undefined,
        watchingId: type === "admin" ? id : undefined,
        allowedEmployeeIds:
          type === "admin" ? (request as any).monitorAllowedEmployeeIds : undefined,
      };

      wss.emit("connection", ws, request, client);
    });
  });

  wss.on("connection", (socket: WebSocket, _request: http.IncomingMessage, client: ScreenClient) => {
    socket.on("pong", () => {
      client.isAlive = true;
    });

    socket.on("error", () => {
      closeClient(client);
    });

    socket.on("close", () => {
      closeClient(client);
    });

    socket.on("message", async (data, isBinary) => {
      if (client.type === "employee") {
        if (isBinary && Buffer.isBuffer(data)) {
          // A pending monitoring-capture meta claims the next binary frame as
          // a monitoring screenshot; otherwise binary frames are the live
          // stream relay for watching admins.
          const meta = client.monitoringCaptureMeta;

          if (meta && client.userId) {
            client.monitoringCaptureMeta = undefined;

            try {
              await addCapture(client.userId, meta.shiftId, data, meta.width, meta.height, "desktop");
            } catch {
              // Cap or ownership violations are dropped; the agent keeps its
              // local schedule but the server stays the source of truth.
            }

            return;
          }

          sendToWatchingAdmins(client.id, data);
          return;
        }

        try {
          const message = JSON.parse(data.toString());
          if (message?.type === "status" && message?.event === "online") {
            void registerEmployee(client);
            return;
          }

          if (client.userId && message?.type === "monitoring-mouse") {
            try {
              await addMouseSamples(client.userId, String(message.shiftId || ""), message.samples);
            } catch {
              // Inactive or unknown shifts are dropped silently.
            }
            return;
          }

          if (client.userId && message?.type === "monitoring-capture-meta") {
            client.monitoringCaptureMeta = {
              shiftId: String(message.shiftId || ""),
              width: Math.max(0, Math.round(Number(message.width) || 0)),
              height: Math.max(0, Math.round(Number(message.height) || 0)),
            };
            return;
          }
        } catch {
          sendJson(socket, { type: "error", message: "Invalid employee message" });
        }

        return;
      }

      try {
        const message = JSON.parse(data.toString());
        const targetId = String(message?.id || client.watchingId || client.id);

        if (message?.action === "GET_PRESENCE") {
          await sendPresence(client);
          return;
        }

        if (message?.action === "START_STREAM") {
          await refreshAllowedEmployeeIds(client);

          const assignedAgent = await findAssignedAgentForTarget(client, targetId);
          const employee = assignedAgent
            ? findEmployeeForAgent(assignedAgent)
            : findEmployeeByMonitorId(targetId);

          if (
            client.allowedEmployeeIds &&
            !assignedAgent &&
            !getMonitorAliases(targetId, true).some((alias) =>
              Boolean(client.allowedEmployeeIds?.has(alias))
            )
          ) {
            sendJson(socket, {
              type: "stream",
              event: "employee_unavailable",
              id: targetId,
            });
            return;
          }

          if (!employee) {
            sendJson(socket, {
              type: "stream",
              event: "employee_unavailable",
              id: targetId,
            });
            return;
          }

          client.watchingId = employee.id;
          sendJson(employee.socket, { action: "START_STREAM" });
          sendJson(socket, { type: "stream", event: "started", id: employee.id });
          return;
        }

        if (message?.action === "STOP_STREAM") {
          client.watchingId = undefined;
          sendJson(socket, { type: "stream", event: "stopped", id: targetId });
        }
      } catch {
        sendJson(socket, { type: "error", message: "Invalid admin message" });
      }
    });

    if (client.type === "employee") {
      registerEmployee(client);
      sendJson(socket, { type: "status", event: "registered", id: client.id });
      return;
    }

    admins.add(client);
    sendPresence(client);
  });

  return wss;
}
