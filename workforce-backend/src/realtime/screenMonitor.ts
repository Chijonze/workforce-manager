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

function broadcastPresence() {
  const message: PresenceMessage = {
    type: "presence",
    employees: [...employees.keys()].sort((a, b) => a.localeCompare(b)),
  };

  for (const admin of admins) {
    sendJson(admin.socket, message);
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

async function isMonitorToken(token: string | null) {
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId?: string;
      mfaVerified?: boolean;
    };

    const user = await User.findById(decoded.userId).select("role").lean();
    if (!user || (user.role !== "admin" && user.role !== "supervisor")) return false;
    if (user.role !== "supervisor" && decoded.mfaVerified === false) return false;

    return true;
  } catch {
    return false;
  }
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
  sendJson(client.socket, { action: "START_STREAM" });
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
      const authorizedByJwt = await isMonitorToken(token);

      if (!authorizedByJwt && !authorizedByKey) {
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const client: ScreenClient = {
        id,
        type,
        socket: ws,
        isAlive: true,
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
      employees: [...employees.keys()].sort((a, b) => a.localeCompare(b)),
    });
  });

  return wss;
}
