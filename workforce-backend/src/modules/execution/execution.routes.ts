import { Router } from "express";
import { protect, requireAdmin, requireAdminOrSupervisor, requireNonSupervisor } from "../../middleware/auth.middleware";
import {
  getMyDailyPerformance,
  getOverview,
  runMaintenance,
} from "./execution.controller";

export const router = Router();

router.get("/me/daily", protect, requireNonSupervisor, getMyDailyPerformance);
router.get("/admin/overview", protect, requireAdminOrSupervisor, getOverview);
router.post("/admin/maintenance", protect, requireAdmin, runMaintenance);
