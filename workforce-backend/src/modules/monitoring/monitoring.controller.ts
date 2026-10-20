import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { CAPTURE_INTERVAL_MINUTES } from "../../models/MonitoringSession";
import ShiftSession from "../../models/ShiftSession";
import * as monitoringService from "./monitoring.service";

type AuthedRequest = Request & { user?: { userId: string; role: string } };

const requesterOf = (req: AuthedRequest) => ({
  userId: String(req.user?.userId || ""),
  role: String(req.user?.role || ""),
});

const isObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

export const startMonitoringSession = async (req: AuthedRequest, res: Response) => {
  try {
    const { shiftId } = req.body || {};

    if (!shiftId || !isObjectId(String(shiftId))) {
      return res.status(400).json({ message: "A valid shiftId is required" });
    }

    const session = await monitoringService.ensureMonitoringSession(
      requesterOf(req).userId,
      String(shiftId)
    );

    res.status(201).json({
      monitoringSessionId: session._id,
      capturePlan: session.capturePlan,
      captureIntervalMinutes: CAPTURE_INTERVAL_MINUTES,
      captures: session.captures.length,
      startedAt: session.startedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const postMouseSamples = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");

    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    const updated = await monitoringService.addMouseSamples(
      requesterOf(req).userId,
      shiftId,
      (req.body || {}).samples,
      "browser"
    );

    if (!updated) {
      return res.status(404).json({ message: "Monitoring session not found or already ended" });
    }

    res.json({
      ok: true,
      sampleCount: updated.mouseTotals?.sampleCount ?? 0,
      desktopAgentActive: Boolean(updated.desktopAgentActive),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const getMonitoringSessionState = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");

    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    const state = await monitoringService.getMonitoringSessionState(
      requesterOf(req).userId,
      shiftId
    );

    if (!state) {
      return res.status(404).json({ message: "Monitoring session not found" });
    }

    res.json(state);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const postCapture = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");

    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    const image = Buffer.isBuffer(req.body) ? req.body : null;

    if (!image) {
      return res.status(400).json({ message: "Expected a raw image body" });
    }

    const result = await monitoringService.addCapture(
      requesterOf(req).userId,
      shiftId,
      image,
      Number(req.query.width) || 0,
      Number(req.query.height) || 0,
      "browser",
      Math.round(Number(req.query.protocol) || 1)
    );

    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const endMonitoringSession = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");

    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    // The route is worker-writable, so scope it to the caller's own shift.
    const shift = await ShiftSession.findOne({
      _id: shiftId,
      userId: requesterOf(req).userId,
    }).select("status");

    if (!shift) {
      return res.status(404).json({ message: "Shift not found" });
    }

    // Monitoring is tied to the shift lifecycle. A page unload/reload must not
    // disable screenshots for the rest of an active shift; only the shift-end
    // and auto-close paths close the monitoring session for an active shift.
    if (shift.status === "active") {
      return res.json({ ok: true, ended: false });
    }

    const status = req.body?.status === "expired" ? "expired" : "completed";
    const updated = await monitoringService.endMonitoringSession(shiftId, status);

    res.json({ ok: true, ended: Boolean(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    res.status(400).json({ message });
  }
};

export const getShiftMonitoring = async (req: AuthedRequest, res: Response) => {
  try {
    const shiftId = String(req.params.shiftId || "");

    if (!isObjectId(shiftId)) {
      return res.status(400).json({ message: "Invalid shift ID format" });
    }

    const result = await monitoringService.getShiftMonitoring(shiftId, requesterOf(req));

    if (!result) {
      return res.status(404).json({ message: "No monitoring session for this shift" });
    }

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    const status = /not allowed/i.test(message) ? 403 : 400;
    res.status(status).json({ message });
  }
};

export const listUserMonitoring = async (req: AuthedRequest, res: Response) => {
  try {
    const userId = String(req.params.userId || "");

    if (!isObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const sessions = await monitoringService.listUserMonitoring(
      userId,
      requesterOf(req),
      Number(req.query.limit) || 20
    );

    res.json(sessions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    const status = /not allowed/i.test(message) ? 403 : 400;
    res.status(status).json({ message });
  }
};

export const getCaptureFile = async (req: AuthedRequest, res: Response) => {
  try {
    const captureId = String(req.params.captureId || "");

    if (!isObjectId(captureId)) {
      return res.status(400).json({ message: "Invalid capture ID format" });
    }

    const { capture } = await monitoringService.readCaptureFile(captureId, requesterOf(req));

    // filePath is always produced server-side at upload time, never from user
    // input, so serving it directly cannot be turned into a path traversal.
    await fs.promises.access(capture.filePath, fs.constants.R_OK);

    // New captures are WebP; legacy ones are JPEG and have no mimeType.
    res.setHeader("Content-Type", capture.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    res.sendFile(path.resolve(capture.filePath), (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ message: "Capture file missing" });
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unknown error occurred";
    const status = /not allowed/i.test(message) ? 403 : /not found|missing/i.test(message) ? 404 : 400;
    res.status(status).json({ message });
  }
};
