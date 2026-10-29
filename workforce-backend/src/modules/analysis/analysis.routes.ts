import { Router } from "express";
import { protect, requireAdminOrSupervisor } from "../../middleware/auth.middleware";
import * as controller from "./analysis.controller";

export const router = Router();

router.use(protect, requireAdminOrSupervisor);

router.get("/overview", controller.getOverview);
router.get("/quota", controller.getQuotaStatus);
router.get("/aggregate", controller.getAggregate);
router.post("/aggregate/narrative", controller.generateAggregateNarrative);
router.get("/workers", controller.listWorkers);
router.get("/workers/:userId/shifts", controller.listWorkerShifts);
router.get("/shift/:shiftId", controller.getShiftAnalysis);
router.post("/shift/:shiftId/generate", controller.generateShiftAnalysis);
router.get("/shift/:shiftId/activity", controller.getShiftActivity);
router.post("/shift/:shiftId/activity", controller.generateShiftActivity);
