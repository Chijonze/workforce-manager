import express from "express";
import cors from "cors";
import { router as authRoutes } from "./modules/auth/auth.routes";
import { router as attendanceRoutes } from "./modules/attendance/attendance.routes";
import { router as executionRoutes } from "./modules/execution/execution.routes";
import { router as leaveRoutes } from "./modules/leave/leave.routes";
import { router as shiftTemplateRoutes } from "./modules/scheduling/shiftTemplate/shiftTemplate.routes";
import { router as scheduleRoutes } from "./modules/scheduling/schedule/schedule.routes";
import { router as chatRoutes } from "./modules/chat/chat.routes";
import { apiSecurityHeaders, createRateLimit } from "./middleware/security.middleware";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || [
  "https://wfm.advancedvirtualsolutions.com",
  "https://advancedvirtualsolutions.com",
].join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(apiSecurityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 86_400,
}));
app.use(express.json({ limit: "32kb" }));
app.use(createRateLimit({ limit: 600, windowMs: 15 * 60_000 }));

const authRateLimit = createRateLimit({ limit: 10, windowMs: 15 * 60_000 });
app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);
app.use("/api/auth/mfa", authRateLimit);

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/execution", executionRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/scheduling/templates", shiftTemplateRoutes);
app.use("/api/scheduling/schedule", scheduleRoutes);

export default app;
