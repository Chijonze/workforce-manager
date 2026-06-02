import { Router } from "express";
import * as AttendanceController from "./attendance.controller";
import { protect, requireNonSupervisor } from "../../middleware/auth.middleware";
import { enforceScheduleMiddleware } from "../scheduling/enforcement/schedule.enforcement.middleware";

export const router = Router();
router.use(protect, requireNonSupervisor);

// Shift lifecycle routes
router.post(
  "/shift/start",
  enforceScheduleMiddleware("SHIFT_START"),
  AttendanceController.startShift
);
router.get("/shift/active", AttendanceController.getActiveShift);
router.get("/shift/:shiftId/status", AttendanceController.getShiftStatus);
router.get("/shift/:shiftId/events", AttendanceController.getShiftEvents);
router.post("/work/start", AttendanceController.startWork);
router.post("/activity/start", AttendanceController.startActivity);
router.post("/break/start", AttendanceController.startBreak);
router.post("/break/end", AttendanceController.endBreak);
router.post("/shift/end", AttendanceController.endShift);
