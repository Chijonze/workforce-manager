import { Request, Response } from "express";
import {
  getAdminOverview,
  getAdminExecutionReport,
  getDailyPerformance,
  runExecutionMaintenance,
} from "./execution.service";

export const getMyDailyPerformance = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const performance = await getDailyPerformance(
      userId,
      String(req.query.date || new Date())
    );

    res.status(200).json(performance);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getOverview = async (req: Request, res: Response) => {
  try {
    const overview = await getAdminOverview(String(req.query.date || new Date()), (req as any).user);

    res.status(200).json(overview);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getExecutionReport = async (req: Request, res: Response) => {
  try {
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const report = await getAdminExecutionReport(startDate, endDate, (req as any).user);
    return res.status(200).json(report);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const runMaintenance = async (_req: Request, res: Response) => {
  try {
    const result = await runExecutionMaintenance();

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
