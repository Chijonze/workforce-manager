const { app, BrowserWindow, ipcMain, nativeImage, screen, desktopCapturer } = require("electron");
const fs = require("fs");
const path = require("path");
const screenshot = require("screenshot-desktop");
const WebSocket = require("ws");

const DEFAULT_CONFIG = {
  serverUrl: "ws://localhost:5000/screen-monitor",
  captureFps: 5,
  jpegQuality: 60,
};

let mainWindow;
let socket = null;
let monitorId = "";
let reconnectTimer = null;
let heartbeatTimer = null;
let captureTimer = null;
let captureInFlight = false;
let streaming = false;
let lastPongAt = 0;
let currentStatus = {
  status: "Disconnected",
  detail: "",
};

// Desktop-wide activity monitoring state (mouse tracking + shift screenshots).
let monitoring = null;
const MONITOR_MOUSE_POLL_MS = 1000;
const MONITOR_MOUSE_FLUSH_MS = 60000;
const MONITOR_MAX_WIDTH = 1280;
const MONITOR_HORIZON_DEFAULT_MS = 8 * 60 * 60 * 1000;
const MONITOR_HORIZON_MAX_MS = 12 * 60 * 60 * 1000;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function getConfigPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "screen-monitor.config.json");
  }

  return path.join(__dirname, "..", "screen-monitor.config.json");
}

function getConfig() {
  return {
    ...DEFAULT_CONFIG,
    ...(readJson(getConfigPath()) || {}),
    serverUrl: process.env.WF_SCREEN_MONITOR_WS_URL || (readJson(getConfigPath()) || {}).serverUrl || DEFAULT_CONFIG.serverUrl,
  };
}

function getStatePath() {
  return path.join(app.getPath("userData"), "state.json");
}

function loadState() {
  return readJson(getStatePath()) || {};
}

function saveState(nextState) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(getStatePath(), JSON.stringify({ ...loadState(), ...nextState }, null, 2));
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function setStatus(status, detail) {
  currentStatus = {
    status,
    detail: detail || "",
  };
  sendToRenderer("monitor:status", { status, detail });
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function stopCapture() {
  streaming = false;

  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
}

function closeSocket() {
  stopHeartbeat();
  stopCapture();
  stopMonitoring();

  if (socket) {
    const activeSocket = socket;
    socket = null;
    activeSocket.removeAllListeners();

    if (activeSocket.readyState === WebSocket.OPEN || activeSocket.readyState === WebSocket.CONNECTING) {
      activeSocket.close();
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer || !monitorId) return;

  setStatus("Waiting", "Retrying connection...");

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(monitorId);
  }, 3000);
}

async function captureFrame() {
  if (!socket || socket.readyState !== WebSocket.OPEN || captureInFlight) return;

  captureInFlight = true;

  try {
    const config = getConfig();
    const png = await screenshot({ format: "png" });
    const image = nativeImage.createFromBuffer(png);

    if (image.isEmpty()) {
      throw new Error("Screen capture returned an empty image");
    }

    const jpeg = image.toJPEG(Math.max(1, Math.min(100, Number(config.jpegQuality) || 60)));
    socket.send(jpeg, { binary: true });
  } catch (error) {
    stopCapture();
    setStatus("Waiting", getCaptureErrorMessage(error));
  } finally {
    captureInFlight = false;
  }
}

function startCapture() {
  if (streaming) return;

  const config = getConfig();
  const fps = Math.max(1, Math.min(10, Number(config.captureFps) || 5));
  streaming = true;
  captureFrame();
  captureTimer = setInterval(captureFrame, Math.floor(1000 / fps));
}

function getCaptureErrorMessage(error) {
  if (process.platform === "darwin") {
    return "macOS blocked screen capture. Open System Settings > Privacy & Security > Screen Recording, allow Workforce Screen Monitor, then restart the app.";
  }

  return error instanceof Error ? error.message : "Unable to capture screen";
}

// ---------------------------------------------------------------------------
// Desktop-wide activity monitoring (mouse tracking + shift screenshots).
// Started by the server with START_MONITORING while the worker has an active
// shift; stops on STOP_MONITORING, socket loss, or app quit.
// ---------------------------------------------------------------------------

function sendMonitoringJson(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function emptyMouseBucket() {
  return { at: "", movements: 0, distancePx: 0, clicks: 0, scrolls: 0 };
}

function pollMousePosition() {
  if (!monitoring) return;

  try {
    const point = screen.getCursorScreenPoint();

    if (monitoring.lastPoint) {
      const dx = point.x - monitoring.lastPoint.x;
      const dy = point.y - monitoring.lastPoint.y;
      const distance = Math.round(Math.hypot(dx, dy));

      if (distance > 0) {
        monitoring.bucket.movements += 1;
        monitoring.bucket.distancePx += distance;
      }
    }

    monitoring.lastPoint = point;
  } catch {
    // Cursor position is unavailable on some desktops; skip this tick.
  }
}

function flushMouseBatch(keepalive = false) {
  if (!monitoring) return;

  const bucket = monitoring.bucket;

  if (!bucket.movements && !bucket.clicks && !bucket.scrolls) return;

  monitoring.bucket = emptyMouseBucket();
  bucket.at = new Date().toISOString();

  const payload = {
    type: "monitoring-mouse",
    shiftId: monitoring.shiftId,
    samples: [bucket],
  };

  try {
    if (keepalive && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      sendMonitoringJson(payload);
    }
  } catch {
    // Missed batches are acceptable; totals are best-effort aggregates.
  }
}

async function takeMonitoringScreenshot() {
  if (!monitoring || !socket || socket.readyState !== WebSocket.OPEN || monitoring.captureInFlight) {
    return;
  }

  monitoring.captureInFlight = true;

  try {
    const config = getConfig();
    const primary = screen.getPrimaryDisplay();
    const scale = Math.min(2, Number(primary.scaleFactor) || 1);
    const thumbnailSize = {
      width: Math.min(2560, Math.round(primary.size.width * scale)),
      height: Math.min(1600, Math.round(primary.size.height * scale)),
    };

    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize });
    const image = sources[0]?.thumbnail;

    if (!image || image.isEmpty()) return;

    const size = image.getSize();
    const resized = size.width > MONITOR_MAX_WIDTH
      ? image.resize({ width: MONITOR_MAX_WIDTH })
      : image;
    const jpeg = resized.toJPEG(Math.max(1, Math.min(100, Number(config.jpegQuality) || 60)));
    const finalSize = resized.getSize();

    monitoring.capturesTaken += 1;
    sendMonitoringJson({
      type: "monitoring-capture-meta",
      shiftId: monitoring.shiftId,
      width: finalSize.width,
      height: finalSize.height,
    });
    socket.send(jpeg, { binary: true });
  } catch {
    // Permission errors or transient capture failures are skipped silently;
    // the server-enforced capture cap bounds total screenshots regardless.
  } finally {
    monitoring.captureInFlight = false;
  }
}

function stopMonitoring() {
  if (!monitoring) return;

  flushMouseBatch(true);

  if (monitoring.mouseTimer) {
    clearInterval(monitoring.mouseTimer);
    monitoring.mouseTimer = null;
  }

  if (monitoring.flushTimer) {
    clearInterval(monitoring.flushTimer);
    monitoring.flushTimer = null;
  }

  monitoring.captureTimers.forEach((timer) => clearTimeout(timer));
  monitoring.captureTimers.clear();
  monitoring = null;

  if (socket && socket.readyState === WebSocket.OPEN) {
    setStatus("Live", "Connected and available for monitoring.");
  }
}

function startMonitoring(message) {
  const shiftId = String(message.shiftId || "");

  if (!shiftId) return;

  if (monitoring && monitoring.shiftId === shiftId) return;

  stopMonitoring();

  const now = Date.now();
  const scheduledEnd = message.scheduledEndTime ? new Date(message.scheduledEndTime).getTime() : 0;
  const horizonMs = scheduledEnd > now
    ? scheduledEnd - now
    : MONITOR_HORIZON_DEFAULT_MS;

  monitoring = {
    shiftId,
    capturePlan: Math.max(0, Math.min(10, Number(message.capturePlan) || 0)),
    capturesTaken: Math.max(0, Math.round(Number(message.capturesTaken) || 0)),
    bucket: emptyMouseBucket(),
    lastPoint: null,
    mouseTimer: null,
    flushTimer: null,
    captureTimers: new Set(),
    captureInFlight: false,
  };

  monitoring.mouseTimer = setInterval(pollMousePosition, MONITOR_MOUSE_POLL_MS);
  monitoring.flushTimer = setInterval(flushMouseBatch, MONITOR_MOUSE_FLUSH_MS);

  // Spread the remaining captures randomly across the rest of the work window.
  const remaining = Math.max(0, monitoring.capturePlan - monitoring.capturesTaken);
  const windowMs = Math.min(horizonMs, MONITOR_HORIZON_MAX_MS);

  for (let index = 0; index < remaining; index += 1) {
    const slotStart = (index / remaining) * windowMs;
    const slotEnd = ((index + 1) / remaining) * windowMs;
    const delay = slotStart + Math.random() * Math.max(1, slotEnd - slotStart);
    const timer = setTimeout(() => {
      monitoring?.captureTimers.delete(timer);
      void takeMonitoringScreenshot();
    }, Math.max(5000, delay));
    monitoring.captureTimers.add(timer);
  }

  setStatus("Live", "Activity monitoring active for the current shift.");
}

function buildSocketUrl(id) {
  const url = new URL(getConfig().serverUrl);
  url.searchParams.set("type", "employee");
  url.searchParams.set("id", id);
  return url.toString();
}

function startHeartbeat(activeSocket) {
  stopHeartbeat();
  lastPongAt = Date.now();

  heartbeatTimer = setInterval(() => {
    if (activeSocket.readyState !== WebSocket.OPEN) return;

    if (Date.now() - lastPongAt > 65000) {
      activeSocket.terminate();
      return;
    }

    try {
      activeSocket.ping();
    } catch {
      activeSocket.terminate();
    }
  }, 30000);
}

function connect(id) {
  monitorId = id.trim();

  if (!monitorId) {
    setStatus("Disconnected", "Monitor ID is required");
    return;
  }

  saveState({ monitorId, employeeId: monitorId });
  closeSocket();
  const socketUrl = buildSocketUrl(monitorId);
  setStatus("Connecting", `Connecting to ${socketUrl.replace(/([?&](?:token|key)=)[^&]+/g, "$1***")}`);

  const activeSocket = new WebSocket(socketUrl, {
    perMessageDeflate: false,
    handshakeTimeout: 10000,
  });
  socket = activeSocket;

  activeSocket.on("open", () => {
    setStatus("Live", "Connected and available for monitoring.");
    activeSocket.send(JSON.stringify({ type: "status", event: "online", id: monitorId }));
    startHeartbeat(activeSocket);
  });

  activeSocket.on("pong", () => {
    lastPongAt = Date.now();
  });

  activeSocket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.action === "START_STREAM") {
        setStatus("Live");
        startCapture();
        return;
      }

      if (message.action === "STOP_STREAM") {
        stopCapture();
        setStatus("Live", "Connected and available for monitoring.");
        return;
      }

      if (message.action === "START_MONITORING") {
        startMonitoring(message);
        return;
      }

      if (message.action === "STOP_MONITORING") {
        stopMonitoring();
        setStatus("Live", "Connected and available for monitoring.");
        return;
      }

      if (message.event === "registered") {
        setStatus("Live", "Connected and available for monitoring.");
      }
    } catch {
      setStatus(streaming ? "Live" : "Waiting", "Ignored invalid server command");
    }
  });

  activeSocket.on("error", (error) => {
    setStatus("Disconnected", `Connection failed: ${error.message}`);
  });

  activeSocket.on("close", () => {
    if (socket === activeSocket) {
      socket = null;
    }

    stopHeartbeat();
    stopCapture();
    setStatus("Waiting", "Retrying connection...");
    scheduleReconnect();
  });
}

function shutdown() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  closeSocket();
  setStatus("Disconnected");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 290,
    resizable: false,
    title: "Workforce Screen Monitor",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("monitor:get-state", () => ({
    monitorId: loadState().monitorId || loadState().email || loadState().employeeId || "",
    email: loadState().email || loadState().employeeId || "",
    employeeId: loadState().employeeId || "",
    serverUrl: getConfig().serverUrl,
    status: currentStatus.status,
    detail: currentStatus.detail,
  }));

  ipcMain.handle("monitor:connect", (_event, id) => {
    connect(String(id || ""));
    return { ok: true };
  });

  createWindow();

  const savedMonitorId = String(loadState().monitorId || loadState().email || loadState().employeeId || "").trim();
  if (savedMonitorId) {
    connect(savedMonitorId);
  }
});

app.on("before-quit", () => {
  shutdown();
});

app.on("window-all-closed", () => {
  app.quit();
});
