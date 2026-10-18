import { Request, Response } from "express";
import * as analysisService from "./analysis.service";

type AuthedRequest = Request & { user?: { userId: string; role: string } };

const requesterOf = (req: AuthedRequest) => ({
  userId: String(req.user?.userId || ""),
  role: String(req.user?.role || ""),
});

const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export const getOverview = async (req: AuthedRequest, res: Response) => {
  try {
    const overview = await analysisService.getAnalysisOverview(requesterOf(req));
    res.json(overview);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const listWorkers = async (req: AuthedRequest, res: Response) => {
  try {
    const workers = await analysisService.listAnalysisWorkers(requesterOf(req));
    res.json(workers);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const listWorkerShifts = async (req: AuthedRequest, res: Response) => {
  try {
    const userId = String(req.params.userId || "");
    if (!isObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const shifts = await analysisService.listWorkerConcludedShifts(requesterOf(req), userId);
    res.json(shifts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    const status = /not allowed/i.test(message) ? 403 : 400;
    res.status(status).json({ message });
  }
};

export const getShiftAnalysis = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");
    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    const analysis = await analysisService.getSavedShiftAnalysis(requesterOf(req), shiftId);
    if (!analysis) {
      return res.status(404).json({ message: "No analysis has been generated for this shift yet" });
    }

    res.json(analysis);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    const status = /not allowed/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ message });
  }
};

export const generateShiftAnalysis = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");
    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    const force = req.body?.force !== false;
    const analysis = await analysisService.generateShiftAnalysis(shiftId, {
      force,
      requester: requesterOf(req),
    });

    res.json(analysis);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    const status = /not allowed/i.test(message) ? 403 : /not found|only available/i.test(message) ? 404 : 400;
    res.status(status).json({ message });
  }
};
