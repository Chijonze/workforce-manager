import { Request, Response } from "express";
import * as service from "./schedule.service";

export const assignSchedule = async (req: Request, res: Response) => {
  try {
    const schedule = await service.assignSchedule(req.body);
    res.status(201).json(schedule);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const getSchedules = async (_: Request, res: Response) => {
  try {
    const schedules = await service.getSchedules();
    res.status(200).json(schedules);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(500).json({ message });
  }
};

export const getMySchedule = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const schedules = await service.getUserSchedule(userId);

    res.json(schedules);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(500).json({ message });
  }
};

export const getUserSchedule = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    
    const schedules = await service.getUserSchedule(userId);
    res.json(schedules);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(500).json({ message });
  }
};

export const deleteSchedules = async (req: Request, res: Response) => {
  try {
    const result = await service.deleteSchedulesByDateRange(req.body);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};
