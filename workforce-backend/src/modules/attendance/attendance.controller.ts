import { Request, Response } from "express";
import * as AttendanceService from "./attendance.service";

// Start Shift
export const startShift = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const session = await AttendanceService.startShift(userId);

    res.status(201).json(session);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Start Work
export const startWork = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { shiftId } = req.body;

    const event = await AttendanceService.createEvent(
      userId,
      shiftId,
      "WORK_START"
    );

    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Start Break
export const startBreak = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { shiftId } = req.body;

    const event = await AttendanceService.createEvent(
      userId,
      shiftId,
      "BREAK_START"
    );

    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// End Break
export const endBreak = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { shiftId } = req.body;

    const event = await AttendanceService.createEvent(
      userId,
      shiftId,
      "BREAK_END"
    );

    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// End Shift
export const endShift = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { shiftId } = req.body;

    if (!shiftId) {
      return res.status(400).json({
        message: "shiftId is required",
      });
    }

    const session = await AttendanceService.endShift(userId, shiftId);

    res.status(200).json(session);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getActiveShift = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const activeShift = await AttendanceService.getActiveShift(userId);

    res.status(200).json(activeShift);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getShiftStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const status = await AttendanceService.getShiftStatus(
      userId,
      String(req.params.shiftId)
    );

    res.status(200).json(status);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getShiftEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const events = await AttendanceService.getShiftEvents(
      userId,
      String(req.params.shiftId)
    );

    res.status(200).json(events);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
