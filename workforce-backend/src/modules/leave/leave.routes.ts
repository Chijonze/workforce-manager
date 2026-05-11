import { Router } from "express";
import { protect, requireAdmin } from "../../middleware/auth.middleware";
import * as controller from "./leave.controller";

export const router = Router();

router.post("/", protect, controller.requestLeave);
router.get("/me", protect, controller.getMyLeave);
router.get("/", protect, requireAdmin, controller.getLeaveRequests);
router.put("/:requestId/review", protect, requireAdmin, controller.reviewLeave);
