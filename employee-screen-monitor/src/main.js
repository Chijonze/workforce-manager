const {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  powerSaveBlocker,
  screen,
  desktopCapturer,
} = require("electron");
const fs = require("fs");
const path = require("path");
const screenshot = require("screenshot-desktop");
const WebSocket = require("ws");

const DEFAULT_CONFIG = {
  serverUrl: "ws://localhost:5000/screen-monitor",
  captureFps: 5,
  jpegQuality: 60,
};

// Live streaming hardening. The admin viewer is only as reliable as the capture
// loop below, so every capture is bounded in time, a transient failure retries
// with backoff instead of ending the stream, and black frames (display off,
// session locked, capture-protected content) are reported rather than relayed.
const CAPTURE_TIMEOUT_MS = 8000;
const CAPTURE_RETRY_BASE_MS = 500;
const CAPTURE_RETRY_MAX_MS = 30000;
const STREAM_MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
const BLANK_FRAME_PIXEL_THRESHOLD = 16;
const BLANK_FRAME_MIN_RATIO = 0.98;

let mainWindow;
let socket = null;
let monitorId = "";
let reconnectTimer = null;
let heartbeatTimer = null;
let captureTimer = null;
let captureInFlight = false;
let streaming = false;
let lastPongAt = 0;
let cachedConfig = null;
let captureGeneration = 0;
let captureFailures = 0;
let displaySleepBlockerId = null;
let reportedStreamState = "";
let currentStatus = {
  status: "Disconnected",
  detail: "",
};

// Desktop-wide activity monitoring state (mouse tracking + shift screenshots).
let monitoring = null;
const MONITOR_MOUSE_POLL_MS = 1000;
const MONITOR_MOUSE_FLUSH_MS = 60000;
const MONITOR_MAX_WIDTH = 1280;
// Every screenshot is compressed to stay below this budget. WebP would be
// smaller still, but Electron's NativeImage only encodes JPEG/PNG, so the JPEG
// quality is searched dynamically instead of using one fixed quality.
const MONITOR_MAX_CAPTURE_BYTES = 300 * 1000;
const MONITOR_JPEG_QUALITY_LADDER = [90, 82, 74, 66, 58];
const MONITOR_DOWNSCALE_STEPS = [1, 0.85, 0.7, 0.55, 0.42];
// Fixed cadence, overridable by the server until agents catch up.
const MONITOR_CAPTURE_INTERVAL_MS = 15 * 60 * 1000;
const MONITOR_CAPTURE_INTERVAL_MIN_MS = 60 * 1000;
// Proof-of-life capture shortly after takeover so monitoring is visible
// immediately instead of one full interval later.
const MONITOR_FIRST_CAPTURE_MS = 60 * 1000;
// Fire just after a slot boundary so clock/network skew still lands inside the
// intended 15-minute window.
const MONITOR_CAPTURE_SLOT_OFFSET_MS = 750;

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

// Re-read on each connect, then serve from memory: the capture loop reads the
// config several times a second and must not hit the disk on that path.
function getConfig() {
  if (!cachedConfig) {
    const fileConfig = readJson(getConfigPath()) || {};

    cachedConfig = {
      ...DEFAULT_CONFIG,
      ...fileConfig,
      serverUrl:
        process.env.WF_SCREEN_MONITOR_WS_URL ||
        fileConfig.serverUrl ||
        DEFAULT_CONFIG.serverUrl,
    };
  }

  return cachedConfig;
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
  captureInFlight = false;
  captureGeneration += 1;
  captureFailures = 0;

  if (captureTimer) {
    clearTimeout(captureTimer);
    captureTimer = null;
  }

  allowDisplaySleep();
  reportStreamState("idle");
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

// The capture helper is a child process (cmd.exe -> a .NET BitBlt snapshotted to
// a temp file on Windows). It can hang on a locked session, a first-run compile,
// or an antivirus scan. Without a timeout the in-flight flag would stay set and
// the stream would freeze forever while the UI still claimed to be live.
function withTimeout(promise, timeoutMs, message) {
  // Mark the source promise handled: when the timeout wins, the original
  // operation may still settle later and must not surface as unhandled.
  promise.catch(() => undefined);

  let timer = null;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// Stream state is deduplicated so a display that stays off does not flood the
// relay, while the dashboard still learns why frames are not moving.
function reportStreamState(state, detail = "") {
  const key = `${state}|${detail}`;
  if (reportedStreamState === key) return false;

  reportedStreamState = key;
  sendMonitoringJson({
    type: "stream-state",
    state,
    detail: String(detail || "").slice(0, 180),
  });

  return true;
}

// Without this the worker's display follows the OS power plan (often 10-15
// minutes) and the observer sees the screen go black mid-session.
function preventDisplaySleep() {
  if (displaySleepBlockerId !== null) return;

  try {
    displaySleepBlockerId = powerSaveBlocker.start("prevent-display-sleep");
  } catch {
    displaySleepBlockerId = null;
  }
}

function allowDisplaySleep() {
  if (displaySleepBlockerId === null) return;

  try {
    if (powerSaveBlocker.isStarted(displaySleepBlockerId)) {
      powerSaveBlocker.stop(displaySleepBlockerId);
    }
  } catch {
    // Nothing left to release.
  }

  displaySleepBlockerId = null;
}

// A frame where nearly every sampled pixel is black means the display is off,
// asleep or the session is locked (capture-protected windows also read black).
// Relaying it would replace the last useful frame with a black rectangle.
function isBlankFrame(image) {
  try {
    const original = image.getSize();
    if (!original.width || !original.height) return true;

    // Sample a thumbnail: toBitmap() on a 4K frame would copy ~33MB per frame
    // just to look at a few hundred pixels.
    const sample = original.width > 160 ? image.resize({ width: 160 }) : image;
    const { width, height } = sample.getSize();
    const bitmap = sample.toBitmap();
    const stepX = Math.max(1, Math.floor(width / 32));
    const stepY = Math.max(1, Math.floor(height / 24));
    let samples = 0;
    let blank = 0;

    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const offset = (y * width + x) * 4;
        if (offset + 2 >= bitmap.length) continue;

        samples += 1;
        if (
          bitmap[offset] <= BLANK_FRAME_PIXEL_THRESHOLD &&
          bitmap[offset + 1] <= BLANK_FRAME_PIXEL_THRESHOLD &&
          bitmap[offset + 2] <= BLANK_FRAME_PIXEL_THRESHOLD
        ) {
          blank += 1;
        }
      }
    }

    return samples > 0 && blank / samples >= BLANK_FRAME_MIN_RATIO;
  } catch {
    return false;
  }
}

function getCaptureIntervalMs() {
  const fps = Math.max(1, Math.min(5, Number(getConfig().captureFps) || 5));
  return Math.max(200, Math.floor(1000 / fps));
}

async function captureFrame() {
  if (!streaming || !socket || socket.readyState !== WebSocket.OPEN || captureInFlight) {
    return true;
  }

  // The viewer is behind: dropping this beat is cheaper than queueing frames in
  // memory on the worker's machine.
  if (socket.bufferedAmount > STREAM_MAX_BUFFERED_BYTES) return true;

  const generation = captureGeneration;
  captureInFlight = true;

  try {
    const config = getConfig();
    const png = await withTimeout(
      screenshot({ format: "png" }),
      CAPTURE_TIMEOUT_MS,
      "Screen capture timed out"
    );

    // Stop/restart happened while the capture was in flight: drop the frame.
    if (generation !== captureGeneration || !streaming) return true;

    const image = nativeImage.createFromBuffer(png);

    if (image.isEmpty()) {
      throw new Error("Screen capture returned an empty image");
    }

    if (isBlankFrame(image)) {
      if (reportStreamState("blank", "Worker display is off or the session is locked")) {
        setStatus("Waiting", "Screen is off or locked");
      }

      captureFailures = 0;
      return true;
    }

    if (reportStreamState("live")) {
      setStatus("Live", "Screen is live on the monitoring dashboard.");
    }

    const jpeg = image.toJPEG(Math.max(1, Math.min(100, Number(config.jpegQuality) || 60)));

    try {
      socket.send(jpeg, { binary: true });
    } catch {
      // Socket is closing; its close handler restarts the loop on reconnect.
      return true;
    }

    captureFailures = 0;
    return true;
  } catch (error) {
    if (generation !== captureGeneration) return true;

    captureFailures += 1;
    const detail = getCaptureErrorMessage(error);
    setStatus("Waiting", detail);
    reportStreamState("error", detail);
    return false;
  } finally {
    // A stop/restart may have already cleared the flag; do not let this stale
    // capture clobber the in-flight state of the new loop.
    if (generation === captureGeneration) {
      captureInFlight = false;
    }
  }
}

function scheduleNextCapture(delayMs) {
  if (!streaming) return;

  if (captureTimer) clearTimeout(captureTimer);

  captureTimer = setTimeout(() => {
    captureTimer = null;
    if (!streaming) return;

    void captureFrame().then((ok) => {
      if (!streaming) return;

      if (ok) {
        scheduleNextCapture(getCaptureIntervalMs());
        return;
      }

      // Exponential backoff (500ms -> 30s) keeps a consistently failing capture
      // from hammering the machine, while still recovering on its own when the
      // worker unlocks the screen again.
      const backoff = Math.min(
        CAPTURE_RETRY_MAX_MS,
        CAPTURE_RETRY_BASE_MS * Math.pow(2, Math.min(6, captureFailures))
      );
      scheduleNextCapture(backoff);
    });
  }, delayMs);
}

function startCapture() {
  if (streaming) return;

  streaming = true;
  captureFailures = 0;
  captureGeneration += 1;
  preventDisplaySleep();
  scheduleNextCapture(0);
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

function encodeMonitoringJpeg(image, maxBytes) {
  const originalSize = image.getSize();
  let smallest = null;

  for (const scale of MONITOR_DOWNSCALE_STEPS) {
    const width = Math.max(640, Math.round(originalSize.width * scale));
    const candidate = width >= originalSize.width ? image : image.resize({ width });
    const size = candidate.getSize();

    for (const quality of MONITOR_JPEG_QUALITY_LADDER) {
      const buffer = candidate.toJPEG(quality);
      const encoded = { buffer, width: size.width, height: size.height };

      if (!smallest || buffer.length < smallest.buffer.length) {
        smallest = encoded;
      }

      if (buffer.length <= maxBytes) {
        return encoded;
      }
    }
  }

  return smallest || {
    buffer: image.toJPEG(60),
    width: originalSize.width,
    height: originalSize.height,
  };
}

async function takeMonitoringScreenshot() {
  const state = monitoring;

  if (!state || !socket || socket.readyState !== WebSocket.OPEN || state.captureInFlight) {
    return;
  }

  state.captureInFlight = true;

  try {
    const primary = screen.getPrimaryDisplay();
    const scale = Math.min(2, Number(primary.scaleFactor) || 1);
    const thumbnailSize = {
      width: Math.min(2560, Math.round(primary.size.width * scale)),
      height: Math.min(1600, Math.round(primary.size.height * scale)),
    };

    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize });
    const image = sources[0]?.thumbnail;

    if (!image || image.isEmpty()) return;

    // The shift may have ended while the capture was in flight.
    if (monitoring !== state || !socket || socket.readyState !== WebSocket.OPEN) return;

    const size = image.getSize();
    const resized = size.width > MONITOR_MAX_WIDTH
      ? image.resize({ width: MONITOR_MAX_WIDTH })
      : image;
    const encoded = encodeMonitoringJpeg(resized, MONITOR_MAX_CAPTURE_BYTES);

    state.capturesTaken += 1;
    sendMonitoringJson({
      type: "monitoring-capture-meta",
      shiftId: state.shiftId,
      width: encoded.width,
      height: encoded.height,
      // v2: this client aligns captures to fixed slots, so the server may
      // de-duplicate a browser/desktop handover in the same interval.
      protocol: 2,
    });
    socket.send(encoded.buffer, { binary: true });
  } catch {
    // Permission errors or transient capture failures are skipped silently;
    // the server-enforced capture cap bounds total screenshots regardless.
  } finally {
    state.captureInFlight = false;
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

  if (monitoring.captureTimer) {
    clearTimeout(monitoring.captureTimer);
    monitoring.captureTimer = null;
  }

  if (monitoring.firstCaptureTimer) {
    clearTimeout(monitoring.firstCaptureTimer);
    monitoring.firstCaptureTimer = null;
  }

  monitoring = null;

  if (socket && socket.readyState === WebSocket.OPEN) {
    setStatus("Live", "Connected and available for monitoring.");
  }
}

// Capture slots are anchored to the monitoring session's start time rather
// than to the moment this agent connected. A reconnect or browser/desktop
// handover therefore lands on the same 15-minute beat every other worker uses
// instead of adding an off-schedule screenshot.
function msUntilNextMonitoringSlot() {
  if (!monitoring) return MONITOR_CAPTURE_INTERVAL_MS;

  const interval = monitoring.captureIntervalMs;
  const elapsed = Math.max(0, Date.now() - monitoring.startedAtMs);
  const nextSlot = (Math.floor(elapsed / interval) + 1) * interval;

  return Math.max(1000, nextSlot - elapsed + MONITOR_CAPTURE_SLOT_OFFSET_MS);
}

function scheduleMonitoringCaptures() {
  if (!monitoring) return;

  // Only the very first capture of a shift gets the early proof-of-life shot.
  // Resumed sessions wait for the next aligned slot so reconnects cannot
  // inflate one worker's screenshot count.
  if (monitoring.capturesTaken === 0 && !monitoring.firstCaptureScheduled) {
    monitoring.firstCaptureScheduled = true;
    monitoring.firstCaptureTimer = setTimeout(() => {
      if (!monitoring) return;
      monitoring.firstCaptureTimer = null;
      void takeMonitoringScreenshot().finally(scheduleMonitoringCaptures);
    }, MONITOR_FIRST_CAPTURE_MS);
    return;
  }

  monitoring.captureTimer = setTimeout(() => {
    if (!monitoring) return;
    monitoring.captureTimer = null;
    void takeMonitoringScreenshot().finally(scheduleMonitoringCaptures);
  }, msUntilNextMonitoringSlot());
}

function startMonitoring(message) {
  const shiftId = String(message.shiftId || "");

  if (!shiftId) return;

  if (monitoring && monitoring.shiftId === shiftId) return;

  stopMonitoring();

  const intervalMinutes = Math.round(Number(message.captureIntervalMinutes) || 0);
  const captureIntervalMs = Math.max(
    MONITOR_CAPTURE_INTERVAL_MIN_MS,
    intervalMinutes > 0 ? intervalMinutes * 60 * 1000 : MONITOR_CAPTURE_INTERVAL_MS
  );
  const startedAtMs = new Date(message.startedAt || Date.now()).getTime();

  monitoring = {
    shiftId,
    capturesTaken: Math.max(0, Math.round(Number(message.capturesTaken) || 0)),
    bucket: emptyMouseBucket(),
    lastPoint: null,
    mouseTimer: null,
    flushTimer: null,
    captureTimer: null,
    firstCaptureTimer: null,
    firstCaptureScheduled: false,
    captureIntervalMs,
    startedAtMs: Number.isFinite(startedAtMs) ? startedAtMs : Date.now(),
    captureInFlight: false,
  };

  monitoring.mouseTimer = setInterval(pollMousePosition, MONITOR_MOUSE_POLL_MS);
  monitoring.flushTimer = setInterval(flushMouseBatch, MONITOR_MOUSE_FLUSH_MS);

  // One screenshot per aligned cadence slot until the shift ends, plus an
  // early proof-of-life capture right after the first takeover.
  scheduleMonitoringCaptures();

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
  // Pick up config edits (server URL, fps) on every reconnect.
  cachedConfig = null;

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
