import { Request, Response, NextFunction } from "express";
import { enforceSchedule } from "./schedule.enforcement.service";

export const enforceScheduleMiddleware = (action: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.userId;

      const result = await enforceSchedule(userId, action);

      if (!result.allowed) {
        return res.status(403).json({
          message: result.reason,
          violation: result.violationType,
        });
      }

      // attach schedule context for downstream use
      (req as any).scheduleContext = result.schedule;

      next();
    } catch (err: any) {
      return res.status(500).json({
        message: err.message || "Enforcement error",
      });
    }
  };
};