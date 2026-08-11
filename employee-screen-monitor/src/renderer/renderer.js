const form = document.getElementById("connect-form");
const monitorIdInput = document.getElementById("monitor-id");
const authTokenInput = document.getElementById("auth-token");
const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const detail = document.getElementById("detail");
let saveTimer = null;

function setStatus(status, message = "") {
  statusLabel.textContent = status;
  detail.textContent = message;
  statusDot.dataset.status = status.toLowerCase();
}

window.monitorClient.onStatus(({ status, detail: message }) => {
  setStatus(status, message || "");
});

window.monitorClient.getState().then((state) => {
  monitorIdInput.value = state.monitorId || state.email || state.employeeId || "";
  authTokenInput.value = state.authToken || "";
  if (state.status) {
    setStatus(state.status, state.detail || "");
  } else if (state.serverUrl) {
    detail.textContent = `Server: ${state.serverUrl}`;
  }
});

function connectSavedMonitorId() {
  const monitorId = monitorIdInput.value.trim();
  const authToken = authTokenInput.value.trim();

  if (!monitorId || !authToken) {
    setStatus("Disconnected", "Enter your Workforce user ID and access token.");
    return;
  }

  setStatus("Connecting");
  void window.monitorClient.connect(monitorId, authToken);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  connectSavedMonitorId();
});

monitorIdInput.addEventListener("input", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(connectSavedMonitorId, 600);
});

authTokenInput.addEventListener("input", () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(connectSavedMonitorId, 600);
});
