const form = document.getElementById("connect-form");
const employeeInput = document.getElementById("employee-id");
const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const detail = document.getElementById("detail");
const connectButton = document.getElementById("connect-button");
const disconnectButton = document.getElementById("disconnect-button");

function setStatus(status, message = "") {
  statusLabel.textContent = status;
  detail.textContent = message;
  statusDot.dataset.status = status.toLowerCase();

  const isLive = status === "Live";
  const isConnecting = status === "Connecting";
  employeeInput.disabled = isLive || isConnecting;
  connectButton.disabled = isLive || isConnecting;
  disconnectButton.disabled = !isLive && !isConnecting;
}

window.monitorClient.onStatus(({ status, detail: message }) => {
  setStatus(status, message || "");
});

window.monitorClient.getState().then((state) => {
  employeeInput.value = state.employeeId || "";
  if (state.serverUrl) {
    detail.textContent = `Server: ${state.serverUrl}`;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const employeeId = employeeInput.value.trim();

  if (!employeeId) {
    setStatus("Disconnected", "Enter your Employee ID first");
    employeeInput.focus();
    return;
  }

  setStatus("Connecting");
  await window.monitorClient.connect(employeeId);
});

disconnectButton.addEventListener("click", async () => {
  await window.monitorClient.disconnect();
  setStatus("Disconnected");
});
