import { Router } from "express";
import * as controller from "./schedule.controller";
import { protect, requireAdmin } from "../../../middleware/auth.middleware";

export const router = Router();

router.post("/", protect, requireAdmin, controller.assignSchedule);
router.get("/", protect, requireAdmin, controller.getSchedules);
router.delete("/", protect, requireAdmin, controller.deleteSchedules);
router.get("/me", protect, controller.getMySchedule);
router.get("/user/:userId", protect, requireAdmin, controller.getUserSchedule);
