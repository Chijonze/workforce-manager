import { Router } from "express";
import * as AttendanceController from "./attendance.controller";
import { protect } from "../../middleware/auth.middleware";
import { enforceScheduleMiddleware } from "../scheduling/enforcement/schedule.enforcement.middleware";

export const router = Router();

// Shift lifecycle routes
router.post(
  "/shift/start",
  protect,
  enforceScheduleMiddleware("SHIFT_START"),
  AttendanceController.startShift
);
router.get("/shift/active", protect, AttendanceController.getActiveShift);
router.get("/shift/:shiftId/status", protect, AttendanceController.getShiftStatus);
router.get("/shift/:shiftId/events", protect, AttendanceController.getShiftEvents);
router.post("/work/start", protect, AttendanceController.startWork);
router.post("/activity/start", protect, AttendanceController.startActivity);
router.post("/break/start", protect, AttendanceController.startBreak);
router.post("/break/end", protect, AttendanceController.endBreak);
router.post("/shift/end", protect, AttendanceController.endShift);
