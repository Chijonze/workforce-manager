import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { attachScreenMonitorServer } from "./realtime/screenMonitor";
import { autoCloseExpiredShifts } from "./modules/execution/execution.service";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Shift records are closed at the scheduled end even when the user leaves
  // the browser open or never submits an end-shift request.
  await autoCloseExpiredShifts().catch((error) => {
    console.error("Initial shift auto-close failed", error);
  });
  const maintenanceTimer = setInterval(() => {
    void autoCloseExpiredShifts().catch((error) => {
      console.error("Shift auto-close failed", error);
    });
  }, 60_000);
  maintenanceTimer.unref();

  const server = http.createServer(app);
  attachScreenMonitorServer(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
