"use client";

import { getApiUrl } from "./api";

export type MonitoringStats = {
  shiftId: string;
  running: boolean;
  capturePlan: number;
  capturesTaken: number;
  capturesEnabled: boolean;
  captureNotice: string | null;
  mouse: { movements: number; distancePx: number; clicks: number; scrolls: number };
};

export type MonitoringHandle = {
  shiftId: string;
  stop: () => void;
};

type EngineOptions = {
  token: string;
  shiftId: string;
  plannedEndTime?: string | null;
  onState: (stats: MonitoringStats) => void;
};

const MOUSE_FLUSH_MS = 60_000;
const MAX_CAPTURE_WIDTH = 1280;
const JPEG_QUALITY = 0.6;
const DEFAULT_FLUID_WINDOW_HOURS = 8;
const MAX_WINDOW_HOURS = 12;

// Counts only — one tiny object mutated in place. No per-event allocation, so
// the listeners stay negligible even under heavy mouse activity.
type Bucket = {
  movements: number;
  distancePx: number;
  clicks: number;
  scrolls: number;
};

const emptyBucket = (): Bucket => ({ movements: 0, distancePx: 0, clicks: 0, scrolls: 0 });

const authHeaders = (token: string): HeadersInit => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

async function postJson(token: string, path: string, body: unknown, keepalive = false) {
  await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
    keepalive,
  });
}

/**
 * Runs worker activity monitoring for one shift:
 *  - mouse tracking (aggregated per minute, from "Available" to "End shift")
 *  - 7-10 automatic randomized screenshots across the work window
 *
 * Deliberately frugal: counters instead of event streams, one small upload per
 * minute, screenshots taken from a display stream that stays paused between
 * captures, and a single reused canvas. Server load is a few tiny requests per
 * worker per hour plus at most ten ~100KB JPEGs per shift.
 */
export function createMonitoringSession(options: EngineOptions): MonitoringHandle {
  const { token, shiftId, plannedEndTime, onState } = options;

  let stopped = false;
  let capturePlan = 0;
  let capturesTaken = 0;
  let capturesEnabled = false;
  let captureNotice: string | null = null;
  let bucket = emptyBucket();
  const totals = { movements: 0, distancePx: 0, clicks: 0, scrolls: 0 };

  const flushTimer = window.setInterval(() => void flushMouse(false), MOUSE_FLUSH_MS);
  const captureTimers = new Set<number>();

  const emit = () => {
    onState({
      shiftId,
      running: !stopped,
      capturePlan,
      capturesTaken,
      capturesEnabled,
      captureNotice,
      mouse: { ...totals },
    });
  };

  const onMouseMove = (event: MouseEvent) => {
    bucket.movements += 1;
    bucket.distancePx += Math.round(Math.hypot(event.movementX || 0, event.movementY || 0));
  };
  const onMouseDown = () => {
    bucket.clicks += 1;
  };
  const onWheel = () => {
    bucket.scrolls += 1;
  };

  window.addEventListener("mousemove", onMouseMove, { passive: true });
  window.addEventListener("mousedown", onMouseDown, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: true });

  async function flushMouse(keepalive: boolean) {
    if (stopped) return;

    const pending = bucket;
    if (!pending.movements && !pending.clicks && !pending.scrolls) return;

    bucket = emptyBucket();
    totals.movements += pending.movements;
    totals.distancePx += pending.distancePx;
    totals.clicks += pending.clicks;
    totals.scrolls += pending.scrolls;
    emit();

    try {
      await postJson(token, `/api/monitoring/session/${shiftId}/mouse`, {
        samples: [{ at: new Date().toISOString(), ...pending }],
      }, keepalive);
    } catch {
      // Monitoring data is best-effort; a failed batch is simply dropped.
    }
  }

  async function captureFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement, seq: number) {
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (!width || !height) return;

    const scale = width > MAX_CAPTURE_WIDTH ? MAX_CAPTURE_WIDTH / width : 1;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || stopped) return;

    await fetch(
      `${getApiUrl()}/api/monitoring/session/${shiftId}/capture?seq=${seq}&width=${canvas.width}&height=${canvas.height}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Authorization: `Bearer ${token}`,
        },
        body: blob,
      }
    );

    capturesTaken += 1;
    emit();
  }

  function startCaptureService() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      capturesEnabled = false;
      captureNotice = "Screen capture is not supported in this browser";
      emit();
      return;
    }

    navigator.mediaDevices
      .getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        capturesEnabled = true;
        captureNotice = null;
        emit();

        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        // Kept paused between captures: no frames are decoded or composited
        // unless a screenshot is actually being taken.
        const canvas = document.createElement("canvas");

        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          capturesEnabled = false;
          captureNotice = "Screen sharing was stopped";
          emit();
        });

        const scheduleCapture = (seq: number, delayMs: number) => {
          const timer = window.setTimeout(() => {
            captureTimers.delete(timer);
            if (stopped || !capturesEnabled) return;

            video.play()
              .then(() => new Promise((resolve) => window.setTimeout(resolve, 400)))
              .then(() => captureFromVideo(video, canvas, seq))
              .catch(() => undefined)
              .finally(() => video.pause());
          }, delayMs);
          captureTimers.add(timer);
        };

        // Distribute the planned captures randomly across the work window so
        // they cannot be predicted; the shift may legitimately end early, in
        // which case the remaining timers simply never fire.
        const now = Date.now();
        const plannedEnd = plannedEndTime ? new Date(plannedEndTime).getTime() : 0;
        const horizon = plannedEnd > now
          ? plannedEnd - now
          : DEFAULT_FLUID_WINDOW_HOURS * 60 * 60_000;
        const windowMs = Math.min(horizon, MAX_WINDOW_HOURS * 60 * 60_000);

        for (let index = 0; index < capturePlan; index += 1) {
          const slotStart = (index / capturePlan) * windowMs;
          const slotEnd = ((index + 1) / capturePlan) * windowMs;
          const delay = slotStart + Math.random() * (slotEnd - slotStart);
          scheduleCapture(index + 1, Math.max(5_000, delay));
        }
      })
      .catch(() => {
        capturesEnabled = false;
        captureNotice = "Screen capture permission was not granted";
        emit();
      });
  }

  (async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/monitoring/session/start`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ shiftId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Monitoring setup failed");

      capturePlan = Number(data.capturePlan) || 0;
      emit();
      startCaptureService();
    } catch {
      captureNotice = "Activity monitoring is unavailable for this shift";
      emit();
    }
  })();

  emit();

  return {
    shiftId,
    stop() {
      if (stopped) return;
      stopped = true;

      window.clearInterval(flushTimer);
      captureTimers.forEach((timer) => window.clearTimeout(timer));
      captureTimers.clear();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("wheel", onWheel);

      // Best-effort final flush + session close; the server also closes the
      // monitoring session when the shift itself ends.
      void flushMouse(true).catch(() => undefined);
      void postJson(token, `/api/monitoring/session/${shiftId}/end`, { status: "completed" }, true)
        .catch(() => undefined);

      emit();
    },
  };
}
