import { Router } from "express";
import { protect, requireNonSupervisor } from "../../middleware/auth.middleware";
import {
  conversations,
  createMessage,
  messages,
  openConversation,
  recipients,
} from "./chat.controller";

export const router = Router();

router.use(protect, requireNonSupervisor);
router.get("/recipients", recipients);
router.get("/conversations", conversations);
router.post("/conversations", openConversation);
router.get("/conversations/:conversationId/messages", messages);
router.post("/messages", createMessage);
