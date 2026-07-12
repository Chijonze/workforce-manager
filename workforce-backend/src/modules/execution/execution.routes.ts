import { Router } from "express";
import { protect, requireAdmin, requireAdminOrSupervisor, requireNonSupervisor } from "../../middleware/auth.middleware";
import {
  getMyDailyPerformance,
  getOverview,
  getExecutionReport,
  runMaintenance,
} from "./execution.controller";

export const router = Router();

router.get("/me/daily", protect, requireNonSupervisor, getMyDailyPerformance);
router.get("/admin/overview", protect, requireAdminOrSupervisor, getOverview);
router.get("/admin/report", protect, requireAdminOrSupervisor, getExecutionReport);
router.post("/admin/maintenance", protect, requireAdmin, runMaintenance);
