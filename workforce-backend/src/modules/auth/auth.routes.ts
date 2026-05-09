import { Router } from "express";
import { register, login, me, listUsers } from "./auth.controller";
import { protect, requireAdmin } from "../../middleware/auth.middleware";

export const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);
router.get("/users", protect, requireAdmin, listUsers);

// 🧪 TEST PROTECTED ROUTE
router.get("/test", protect, (req, res) => {
  res.json({
    message: "Auth middleware working ✅",
    user: (req as any).user,
  });
});
