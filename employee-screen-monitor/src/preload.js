const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("monitorClient", {
  connect: (employeeId) => ipcRenderer.invoke("monitor:connect", employeeId),
  getState: () => ipcRenderer.invoke("monitor:get-state"),
  onStatus: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("monitor:status", listener);
    return () => ipcRenderer.removeListener("monitor:status", listener);
  },
});
