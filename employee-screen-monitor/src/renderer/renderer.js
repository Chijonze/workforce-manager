const form = document.getElementById("connect-form");
const employeeInput = document.getElementById("employee-id");
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
  employeeInput.value = state.employeeId || "";
  if (state.status) {
    setStatus(state.status, state.detail || "");
  } else if (state.serverUrl) {
    detail.textContent = `Server: ${state.serverUrl}`;
  }
});

function connectSavedEmployee() {
  const employeeId = employeeInput.value.trim();

  if (!employeeId) {
    setStatus("Disconnected", "Enter the agent ID to enable automatic streaming.");
    return;
  }

  setStatus("Connecting");
  void window.monitorClient.connect(employeeId);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  connectSavedEmployee();
});

employeeInput.addEventListener("input", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(connectSavedEmployee, 600);
});
