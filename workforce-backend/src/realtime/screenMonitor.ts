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
  userId: string;
  role: "admin" | "supervisor" | "agent";
  assignedAgentIds: string[];
  watchingId?: string;
};

type PresenceMessage = {
  type: "presence";
  employees: string[];
};

const employees = new Map<string, ScreenClient>();
const admins = new Set<ScreenClient>();

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function sendJson(socket: WebSocket, value: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(safeJson(value));
  }
}

function visibleEmployeeIds(admin: ScreenClient) {
  const employeeIds = [...employees.keys()];
  return (admin.role === "admin" ? employeeIds : employeeIds.filter((id) => admin.assignedAgentIds.includes(id)))
    .sort((a, b) => a.localeCompare(b));
}

function broadcastPresence() {
  for (const admin of admins) {
    sendJson(admin.socket, { type: "presence", employees: visibleEmployeeIds(admin) } satisfies PresenceMessage);
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

type MonitorIdentity = Pick<ScreenClient, "userId" | "role" | "assignedAgentIds">;

function getBearerProtocol(request: http.IncomingMessage) {
  const protocols = String(request.headers["sec-websocket-protocol"] || "")
    .split(",")
    .map((protocol) => protocol.trim());
  return protocols[0] === "monitor-v1" ? protocols[1] || null : null;
}

async function getMonitorIdentity(token: string | null): Promise<MonitorIdentity | null> {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId?: string;
      mfaVerified?: boolean;
    };

    const user = await User.findById(decoded.userId)
      .select("_id role accountStatus assignedAgentIds")
      .lean();
    if (!user || user.accountStatus !== "approved") return null;
    if (decoded.mfaVerified === false) return null;
    if (user.role !== "admin" && user.role !== "supervisor" && user.role !== "agent") return null;

    return {
      userId: user._id.toString(),
      role: user.role,
      assignedAgentIds: (user.assignedAgentIds || []).map(String),
    };
  } catch {
    return null;
  }
}

function canWatch(client: ScreenClient, employeeId: string) {
  return client.role === "admin" || (client.role === "supervisor" && client.assignedAgentIds.includes(employeeId));
}

function sendToWatchingAdmins(employeeId: string, frame: Buffer) {
  for (const admin of admins) {
    if (admin.watchingId === employeeId && admin.socket.readyState === WebSocket.OPEN) {
      admin.socket.send(frame, { binary: true });
    }
  }
}

function registerEmployee(client: ScreenClient) {
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

    const identity = await getMonitorIdentity(getBearerProtocol(request));
    const allowed = identity && (
      (type === "employee" && identity.role === "agent" && identity.userId === id) ||
      (type === "admin" && (identity.role === "admin" || identity.role === "supervisor"))
    );

    if (!allowed || !identity) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const client: ScreenClient = {
        id,
        type,
        socket: ws,
        isAlive: true,
        ...identity,
        watchingId: type === "admin" ? id : undefined,
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

    socket.on("message", (data, isBinary) => {
      if (client.type === "employee") {
        if (isBinary && Buffer.isBuffer(data)) {
          sendToWatchingAdmins(client.id, data);
          return;
        }

        try {
          const message = JSON.parse(data.toString());
          if (message?.type === "status" && message?.event === "online") {
            registerEmployee(client);
          }
        } catch {
          sendJson(socket, { type: "error", message: "Invalid employee message" });
        }

        return;
      }

      try {
        const message = JSON.parse(data.toString());
        const targetId = String(message?.id || client.watchingId || client.id);

        if (message?.action === "START_STREAM") {
          if (!canWatch(client, targetId)) {
            sendJson(socket, { type: "error", message: "Not authorized to monitor this employee" });
            return;
          }
          const employee = employees.get(targetId);
          if (!employee) {
            sendJson(socket, {
              type: "stream",
              event: "employee_unavailable",
              id: targetId,
            });
            return;
          }

          client.watchingId = targetId;
          sendJson(employee.socket, { action: "START_STREAM" });
          sendJson(socket, { type: "stream", event: "started", id: targetId });
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
    sendJson(socket, {
      type: "presence",
      employees: visibleEmployeeIds(client),
    });
  });

  return wss;
}
