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
  "serverUrl": "wss://api.advancedvirtualsolutions.com/screen-monitor",
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

## Build A macOS App

For this tool, a native desktop app is a better fit than a PWA. The app needs admin-triggered screen capture while connected to the Workforce Manager relay. Browser/PWA screen sharing generally requires repeated user selection and is not reliable as a background employee monitor.

Build the macOS app on a Mac:

```bash
npm install
npm run build:mac
```

The macOS build writes a DMG and ZIP into `dist/`. For a quick unpacked test build:

```bash
npm run pack:mac
```

On first capture, macOS may block the screen until permission is granted. Open **System Settings > Privacy & Security > Screen Recording**, enable **Workforce Screen Monitor**, then restart the app.

For broad external distribution, sign and notarize the app with an Apple Developer ID certificate. Unsigned builds can still be used for internal testing, but macOS Gatekeeper may require the user to explicitly allow the app.

## Build macOS From Windows

You can build the Mac app from a Windows development machine by using the GitHub Actions workflow at `.github/workflows/build-mac-screen-monitor.yml`.

1. Push the repository to GitHub.
2. Open the GitHub repo, then go to **Actions**.
3. Select **Build Mac Screen Monitor**.
4. Click **Run workflow**.
5. When the run finishes, open the run and download the **workforce-screen-monitor-mac** artifact.

The workflow runs on GitHub's hosted macOS runner and uploads the generated DMG/ZIP from `employee-screen-monitor/dist/`.

## VPS Notes

The desktop client sends JPEG frames only while streaming is active. Closing the admin viewer sends `STOP_STREAM`, clears the capture timer, and returns the employee app to idle.

## Shift activity monitoring (v1.1+)

Besides on-demand live streaming, current builds also handle **desktop-wide
activity monitoring** for the signed-in worker's active shift:

- While a worker with an active shift is connected, the server sends
  `START_MONITORING` (and later `STOP_MONITORING` when the shift ends). The
  agent then reports aggregated mouse movement (position sampled every second,
  one small batch per minute) and takes that shift's remaining 7-10 randomized
  screenshots via `desktopCapturer` — no new permission prompts beyond the
  standard Screen Recording permission.
- Everything rides the existing WebSocket connection with no new login.
- Older builds without this feature keep working exactly as before: they simply
  ignore the `START_MONITORING`/`STOP_MONITORING` commands, and the dashboard
  falls back to browser-scoped tracking.

