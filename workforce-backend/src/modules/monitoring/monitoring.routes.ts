import { Router, raw } from "express";
import { protect, requireNonSupervisor } from "../../middleware/auth.middleware";
import * as controller from "./monitoring.controller";

export const router = Router();

router.use(protect);

// Agent-only write endpoints: workers report their own monitoring data.
const agentWrite = [protect, requireNonSupervisor];

// Raw JPEG upload — parsed as a buffer only on this route, keeping the global
// JSON parser and its 32kb limit untouched elsewhere.
router.post(
  "/session/:shiftId/capture",
  agentWrite,
  raw({ type: "application/octet-stream", limit: "2mb" }),
  controller.postCapture
);
router.post("/session/start", agentWrite, controller.startMonitoringSession);
router.get("/session/:shiftId/state", agentWrite, controller.getMonitoringSessionState);
router.post("/session/:shiftId/mouse", agentWrite, controller.postMouseSamples);
router.post("/session/:shiftId/end", agentWrite, controller.endMonitoringSession);

// Read endpoints: admins (all), supervisors (assigned agents only), and the
// owning agent. Access checks live in the service layer.
router.get("/shift/:shiftId", controller.getShiftMonitoring);
router.get("/user/:userId/shifts", controller.listUserMonitoring);
router.get("/captures/:captureId/file", controller.getCaptureFile);
