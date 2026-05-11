import express from "express";
import cors from "cors";
import { router as authRoutes } from "./modules/auth/auth.routes";
import { router as attendanceRoutes } from "./modules/attendance/attendance.routes";
import { router as executionRoutes } from "./modules/execution/execution.routes";
import { router as leaveRoutes } from "./modules/leave/leave.routes";
import { router as shiftTemplateRoutes } from "./modules/scheduling/shiftTemplate/shiftTemplate.routes";
import { router as scheduleRoutes } from "./modules/scheduling/schedule/schedule.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/execution", executionRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/scheduling/templates", shiftTemplateRoutes);
app.use("/api/scheduling/schedule", scheduleRoutes);

export default app;
