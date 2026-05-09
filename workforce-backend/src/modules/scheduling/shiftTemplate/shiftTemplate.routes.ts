import { Router } from "express";
import * as controller from "./shiftTemplate.controller";
import { protect, requireAdmin } from "../../../middleware/auth.middleware";

export const router = Router();

router.post("/", protect, requireAdmin, controller.createTemplate);
router.get("/", protect, requireAdmin, controller.getTemplates);
router.get("/:id", protect, requireAdmin, controller.getTemplateById);
router.put("/:id", protect, requireAdmin, controller.updateTemplate);
router.delete("/:id", protect, requireAdmin, controller.deleteTemplate);
