import http from "http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import User from "../models/User";

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
};

type MonitorEmployee = {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  activeMonitorId?: string;
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

async function refreshAllowedEmployeeIds(admin: ScreenClient) {
  if (admin.type !== "admin" || admin.authRole !== "supervisor" || !admin.authUserId) return;

  const user = await User.findById(admin.authUserId)
    .select("assignedAgentIds")
    .populate("assignedAgentIds", "_id name email")
    .lean();

  const assignedAgents = ((user?.assignedAgentIds || []) as any[]).map((agent) => {
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
      monitorIds,
    };
  });

  admin.allowedEmployeeIds = new Set(assignedAgents.flatMap((agent) => agent.monitorIds));
  admin.assignedEmployees = assignedAgents
    .map(({ monitorIds: _monitorIds, ...agent }) => agent)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (
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
  const agents = await User.find({ role: "agent" }).select("_id name email monitorId").lean();
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
}

export function attachScreenMonitorServer(server: http.Server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024,
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
          sendToWatchingAdmins(client.id, data);
          return;
        }

        try {
          const message = JSON.parse(data.toString());
          if (message?.type === "status" && message?.event === "online") {
            void registerEmployee(client);
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
