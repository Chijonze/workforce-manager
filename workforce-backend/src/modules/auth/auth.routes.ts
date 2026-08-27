import { Router } from "express";
import {
  register,
  login,
  logout,
  me,
  listUsers,
  deleteUser,
  approveUser,
  assignAgents,
  setupMfa,
  confirmMfa,
  verifyMfa,
  verifyReturn,
  updateProfile,
  updateMonitorId,
} from "./auth.controller";
import { protect, requireAdmin, requireNonSupervisor } from "../../middleware/auth.middleware";

export const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/mfa/verify", verifyMfa);
router.get("/me", protect, me);
router.put("/me/profile", protect, updateProfile);
router.post("/mfa/setup", protect, requireNonSupervisor, setupMfa);
router.post("/mfa/confirm", protect, requireNonSupervisor, confirmMfa);
router.post("/mfa/verify-return", protect, requireNonSupervisor, verifyReturn);
router.get("/users", protect, requireAdmin, listUsers);
router.put("/users/:userId/approve", protect, requireAdmin, approveUser);
router.put("/users/:userId/assigned-agents", protect, requireAdmin, assignAgents);
router.put("/users/:userId/monitor-id", protect, requireAdmin, updateMonitorId);
router.delete("/users/:userId", protect, requireAdmin, deleteUser);

// 🧪 TEST PROTECTED ROUTE
router.get("/test", protect, (req, res) => {
  res.json({
    message: "Auth middleware working ✅",
    user: (req as any).user,
  });
});
