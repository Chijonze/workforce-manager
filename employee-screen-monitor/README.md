# Workforce Screen Monitor Employee App

This Electron client connects an employee desktop to the Workforce Manager WebSocket relay. It stays idle after connection and only captures frames after an admin sends `START_STREAM`.

## Local Run

```powershell
npm install
npm run dev
```

## Configure The Server URL

Edit `screen-monitor.config.json` before building:

```json
{
  "serverUrl": "wss://yourdomain.com/screen-monitor",
  "captureFps": 5,
  "jpegQuality": 60
}
```

You can also override it at runtime with `WF_SCREEN_MONITOR_WS_URL`.

## Build A Windows Executable

```powershell
npm install
npm run build:win
```

The portable executable is written to `dist/Workforce-Screen-Monitor-1.0.0-portable.exe`. It includes Electron, Node.js, the app UI, and the screen capture runtime, so remote employees do not need Node.js or npm installed.

For a standard installer instead:

```powershell
npm run build:win-installer
```

## VPS Notes

The desktop client sends JPEG frames only while streaming is active. Closing the admin viewer sends `STOP_STREAM`, clears the capture timer, and returns the employee app to idle.
