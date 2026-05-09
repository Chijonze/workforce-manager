import { Router } from "express";
import { protect, requireAdmin } from "../../middleware/auth.middleware";
import {
  getMyDailyPerformance,
  getOverview,
  runMaintenance,
} from "./execution.controller";

export const router = Router();

router.get("/me/daily", protect, getMyDailyPerformance);
router.get("/admin/overview", protect, requireAdmin, getOverview);
router.post("/admin/maintenance", protect, requireAdmin, runMaintenance);
