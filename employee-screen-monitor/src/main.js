const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
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
let employeeId = "";
let manuallyDisconnected = false;
let reconnectTimer = null;
let heartbeatTimer = null;
let captureTimer = null;
let captureInFlight = false;
let streaming = false;
let lastPongAt = 0;

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
  fs.writeFileSync(getStatePath(), JSON.stringify(nextState, null, 2));
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function setStatus(status, detail) {
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
  if (manuallyDisconnected || reconnectTimer || !employeeId) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(employeeId);
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
    setStatus("Live", error instanceof Error ? error.message : "Unable to capture screen");
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
  employeeId = id.trim();
  manuallyDisconnected = false;

  if (!employeeId) {
    setStatus("Disconnected", "Employee ID is required");
    return;
  }

  closeSocket();
  setStatus("Connecting");

  const activeSocket = new WebSocket(buildSocketUrl(employeeId), {
    perMessageDeflate: false,
    handshakeTimeout: 10000,
  });
  socket = activeSocket;

  activeSocket.on("open", () => {
    setStatus("Live");
    saveState({ employeeId });
    activeSocket.send(JSON.stringify({ type: "status", event: "online", id: employeeId }));
    startHeartbeat(activeSocket);
  });

  activeSocket.on("pong", () => {
    lastPongAt = Date.now();
  });

  activeSocket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.action === "START_STREAM") {
        startCapture();
        return;
      }

      if (message.action === "STOP_STREAM") {
        stopCapture();
      }
    } catch {
      setStatus("Live", "Ignored invalid server command");
    }
  });

  activeSocket.on("error", (error) => {
    setStatus("Disconnected", error.message);
  });

  activeSocket.on("close", () => {
    if (socket === activeSocket) {
      socket = null;
    }

    stopHeartbeat();
    stopCapture();
    setStatus("Disconnected");
    scheduleReconnect();
  });
}

function disconnect() {
  manuallyDisconnected = true;

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
    employeeId: loadState().employeeId || "",
    serverUrl: getConfig().serverUrl,
  }));

  ipcMain.handle("monitor:connect", (_event, id) => {
    connect(String(id || ""));
    return { ok: true };
  });

  ipcMain.handle("monitor:disconnect", () => {
    disconnect();
    return { ok: true };
  });

  createWindow();
});

app.on("before-quit", () => {
  disconnect();
});

app.on("window-all-closed", () => {
  app.quit();
});
