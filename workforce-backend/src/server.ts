import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { attachScreenMonitorServer } from "./realtime/screenMonitor";
import { autoCloseExpiredShifts } from "./modules/execution/execution.service";
import { sweepMissingShiftAnalyses } from "./modules/analysis/analysis.service";
import { runNarrationRetrySweep } from "./modules/vision/narrationRetry.service";
import { visionConfig } from "./modules/vision/vision.config";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Unattended shifts are hard-closed after the maximum active duration.
  await autoCloseExpiredShifts().catch((error) => {
    console.error("Initial shift auto-close failed", error);
  });
  const maintenanceTimer = setInterval(() => {
    void autoCloseExpiredShifts().catch((error) => {
      console.error("Shift auto-close failed", error);
    });
    // Backfill AI analyses for concluded shifts that missed generation.
    void sweepMissingShiftAnalyses().catch((error) => {
      console.error("Shift analysis sweep failed", error);
    });
  }, 60_000);
  maintenanceTimer.unref();

  // Screenshot narration: retry shifts that failed or were cut short. The sweep
  // is a no-op while the Gemini daily quota is exhausted, so it resumes by itself
  // once the 429 reset instant passes.
  const runNarrationRetry = () => {
    void runNarrationRetrySweep()
      .then((result) => {
        if (result.ran) {
          console.log(
            `Narration retry: ${result.shiftId} ${result.status} (${result.blocks} blocks, ${result.remaining} pending)`
          );
        }
      })
      .catch((error) => {
        console.error("Narration retry sweep failed", error);
      });
  };
  const narrationRetryTimer = setInterval(runNarrationRetry, visionConfig.retryIntervalMs);
  narrationRetryTimer.unref();
  const narrationRetryBoot = setTimeout(runNarrationRetry, 120_000);
  narrationRetryBoot.unref();

  const server = http.createServer(app);
  attachScreenMonitorServer(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
