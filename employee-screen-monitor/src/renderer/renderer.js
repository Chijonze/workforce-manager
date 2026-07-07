const form = document.getElementById("connect-form");
const emailInput = document.getElementById("employee-email");
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
  emailInput.value = state.email || state.employeeId || "";
  if (state.status) {
    setStatus(state.status, state.detail || "");
  } else if (state.serverUrl) {
    detail.textContent = `Server: ${state.serverUrl}`;
  }
});

function connectSavedEmail() {
  const email = emailInput.value.trim();

  if (!email) {
    setStatus("Disconnected", "Enter your email to enable automatic streaming.");
    return;
  }

  setStatus("Connecting");
  void window.monitorClient.connect(email);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  connectSavedEmail();
});

emailInput.addEventListener("input", () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(connectSavedEmail, 600);
});
