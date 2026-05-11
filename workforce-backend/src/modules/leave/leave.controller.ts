import { Request, Response } from "express";
import * as LeaveService from "./leave.service";

export const requestLeave = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const request = await LeaveService.requestLeave(userId, req.body);
    res.status(201).json(request);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getMyLeave = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const requests = await LeaveService.getMyLeave(userId);
    res.status(200).json(requests);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getLeaveRequests = async (_req: Request, res: Response) => {
  try {
    const requests = await LeaveService.getLeaveRequests();
    res.status(200).json(requests);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const reviewLeave = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).user.userId;
    const request = await LeaveService.reviewLeave(
      String(req.params.requestId),
      reviewerId,
      req.body
    );
    res.status(200).json(request);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
