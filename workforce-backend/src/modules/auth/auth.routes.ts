import { Router } from "express";
import {
  register,
  login,
  me,
  listUsers,
  setupMfa,
  confirmMfa,
  verifyMfa,
  verifyReturn,
} from "./auth.controller";
import { protect, requireAdmin } from "../../middleware/auth.middleware";

export const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/mfa/verify", verifyMfa);
router.get("/me", protect, me);
router.post("/mfa/setup", protect, setupMfa);
router.post("/mfa/confirm", protect, confirmMfa);
router.post("/mfa/verify-return", protect, verifyReturn);
router.get("/users", protect, requireAdmin, listUsers);

// 🧪 TEST PROTECTED ROUTE
router.get("/test", protect, (req, res) => {
  res.json({
    message: "Auth middleware working ✅",
    user: (req as any).user,
  });
});
