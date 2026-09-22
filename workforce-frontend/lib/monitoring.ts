"use client";

import { getApiUrl } from "./api";

export type MonitoringStats = {
  shiftId: string;
  running: boolean;
  capturePlan: number;
  capturesTaken: number;
  capturesEnabled: boolean;
  captureNotice: string | null;
  viaDesktopAgent: boolean;
  canRetryCapture: boolean;
  mouse: { movements: number; distancePx: number; clicks: number; scrolls: number };
};

export type MonitoringHandle = {
  shiftId: string;
  requestCapture: () => void;
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

/**
 * Runs worker activity monitoring for one shift:
 *  - mouse tracking (aggregated per minute, from "Available" to "End shift")
 *  - 7-10 automatic randomized screenshots across the work window
 *
 * If the worker's desktop agent (Electron) connects, the server hands the
 * shift over to it for desktop-wide tracking; this page then stands down and
 * probes once a minute, resuming browser-scoped tracking if the agent leaves.
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
  let viaDesktopAgent = false;
  let canRetryCapture = false;
  let gestureRetryArmed = false;
  let bucket = emptyBucket();
  const totals = { movements: 0, distancePx: 0, clicks: 0, scrolls: 0 };

  const flushTimer = window.setInterval(() => void flushTick(), MOUSE_FLUSH_MS);
  const captureTimers = new Set<number>();

  const emit = () => {
    onState({
      shiftId,
      running: !stopped,
      capturePlan,
      capturesTaken,
      capturesEnabled,
      captureNotice,
      viaDesktopAgent,
      canRetryCapture,
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

  const attachMouseListeners = () => {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
  };

  const detachMouseListeners = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("wheel", onWheel);
  };

  function clearCaptureTimers() {
    captureTimers.forEach((timer) => window.clearTimeout(timer));
    captureTimers.clear();
  }

  // Once the worker's desktop agent reports in, it owns desktop-wide tracking
  // and the remaining screenshot plan; the browser page stands down so data
  // is not double-counted.
  function supersedeByDesktopAgent() {
    if (viaDesktopAgent) return;

    viaDesktopAgent = true;
    capturesEnabled = false;
    canRetryCapture = false;
    captureNotice = "Desktop agent is handling tracking and screenshots";
    clearCaptureTimers();
    disarmGestureRetry();
    detachMouseListeners();
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    }
    emit();
  }

  async function probeDesktopAgent() {
    try {
      const response = await fetch(`${getApiUrl()}/api/monitoring/session/${shiftId}/state`, {
        headers: authHeaders(token),
      });
      const data = await response.json().catch(() => ({}));

      if (stopped) return;

      if (data?.desktopAgentActive) return;

      // The desktop agent is gone: resume browser-scoped tracking with the
      // server's capture counts as the baseline.
      viaDesktopAgent = false;
      capturePlan = Number(data?.capturePlan) || capturePlan;
      capturesTaken = Math.max(Number(data?.captureCount) || 0, capturesTaken);
      attachMouseListeners();
      startCaptureService();
      emit();
    } catch {
      // Keep probing; the next tick retries.
    }
  }

  function armRemainingCaptures() {
    if (!capturesEnabled || capturePlan <= 0) return;

    const remaining = Math.max(0, capturePlan - capturesTaken);
    if (!remaining) return;

    const now = Date.now();
    const plannedEnd = plannedEndTime ? new Date(plannedEndTime).getTime() : 0;
    const horizon = plannedEnd > now
      ? plannedEnd - now
      : DEFAULT_FLUID_WINDOW_HOURS * 60 * 60_000;
    const windowMs = Math.min(horizon, MAX_WINDOW_HOURS * 60 * 60_000);

    for (let index = 0; index < remaining; index += 1) {
      const slotStart = (index / remaining) * windowMs;
      const slotEnd = ((index + 1) / remaining) * windowMs;
      const delay = slotStart + Math.random() * (slotEnd - slotStart);
      const timer = window.setTimeout(() => {
        captureTimers.delete(timer);
        if (stopped || !capturesEnabled) return;

        const videoEl = video;
        if (!videoEl) return;

        videoEl.play()
          .then(() => new Promise((resolve) => window.setTimeout(resolve, 400)))
          .then(() => captureFromVideo())
          .catch(() => undefined)
          .finally(() => videoEl.pause());
      }, Math.max(5_000, delay));
      captureTimers.add(timer);
    }
  }

  async function flushMouse(keepalive: boolean) {
    if (stopped || viaDesktopAgent) return;

    const pending = bucket;
    if (!pending.movements && !pending.clicks && !pending.scrolls) return;

    bucket = emptyBucket();
    totals.movements += pending.movements;
    totals.distancePx += pending.distancePx;
    totals.clicks += pending.clicks;
    totals.scrolls += pending.scrolls;
    emit();

    try {
      const response = await fetch(`${getApiUrl()}/api/monitoring/session/${shiftId}/mouse`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          samples: [{ at: new Date().toISOString(), ...pending }],
        }),
        keepalive,
      });

      const data = await response.json().catch(() => ({}));

      if (data?.desktopAgentActive) {
        supersedeByDesktopAgent();
      }
    } catch {
      // Monitoring data is best-effort; a failed batch is simply dropped.
    }
  }

  function flushTick() {
    if (stopped) return;
    if (viaDesktopAgent) {
      void probeDesktopAgent();
      return;
    }
    void flushMouse(false);
  }

  let video: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;

  async function captureFromVideo() {
    const videoEl = video;
    const canvasEl = canvas;
    if (!videoEl || !canvasEl) return;

    const width = videoEl.videoWidth || 0;
    const height = videoEl.videoHeight || 0;
    if (!width || !height) return;

    const scale = width > MAX_CAPTURE_WIDTH ? MAX_CAPTURE_WIDTH / width : 1;
    canvasEl.width = Math.round(width * scale);
    canvasEl.height = Math.round(height * scale);

    const context = canvasEl.getContext("2d");
    if (!context) return;

    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvasEl.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || stopped) return;

    await fetch(
      `${getApiUrl()}/api/monitoring/session/${shiftId}/capture?width=${canvasEl.width}&height=${canvasEl.height}`,
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

  // Browsers reject getDisplayMedia without a fresh user gesture, and this
  // session auto-starts on shift load. Retry inside the next click anywhere.
  function retryCaptureFromGesture() {
    gestureRetryArmed = false;
    startCaptureService();
  }

  function armGestureRetry() {
    if (gestureRetryArmed || stopped || viaDesktopAgent) return;

    gestureRetryArmed = true;
    window.addEventListener("pointerdown", retryCaptureFromGesture, { once: true });
  }

  function disarmGestureRetry() {
    if (!gestureRetryArmed) return;

    gestureRetryArmed = false;
    window.removeEventListener("pointerdown", retryCaptureFromGesture);
  }

  function startCaptureService() {
    if (stopped || viaDesktopAgent || capturesEnabled) return;

    if (!navigator.mediaDevices?.getDisplayMedia) {
      captureNotice = "Screen capture is not supported in this browser";
      emit();
      return;
    }

    navigator.mediaDevices
      .getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      .then((stream) => {
        if (stopped || viaDesktopAgent) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        capturesEnabled = true;
        canRetryCapture = false;
        captureNotice = null;
        emit();

        video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        // Kept paused between captures: no frames are decoded or composited
        // unless a screenshot is actually being taken.
        canvas = document.createElement("canvas");

        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (stopped || viaDesktopAgent) return;

          capturesEnabled = false;
          canRetryCapture = true;
          captureNotice = "Screen sharing was stopped";
          clearCaptureTimers();
          emit();
        });

        armRemainingCaptures();
      })
      .catch((error: DOMException) => {
        if (stopped || viaDesktopAgent) return;

        capturesEnabled = false;

        if (error?.name === "InvalidStateError") {
          captureNotice = "Click anywhere in the app to enable screen capture";
          armGestureRetry();
        } else if (error?.name === "NotAllowedError") {
          captureNotice = "Screen capture permission was not granted";
          canRetryCapture = true;
        } else if (error?.name === "NotFoundError" || error?.name === "NotReadableError") {
          captureNotice = "No screen source is available for capture";
        } else {
          captureNotice = "Screen capture could not be started";
        }

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
      capturesTaken = Number(data.captures) || 0;
      emit();
    } catch {
      captureNotice = "Activity monitoring is unavailable for this shift";
      emit();
      return;
    }

    // When the desktop agent is already connected it owns the shift, so stand
    // down before asking the worker for screen access. Otherwise track in this
    // page: attach the mouse listeners and let the browser drive the captures.
    try {
      const stateResponse = await fetch(`${getApiUrl()}/api/monitoring/session/${shiftId}/state`, {
        headers: authHeaders(token),
      });
      const state = await stateResponse.json().catch(() => ({}));

      if (stopped) return;

      if (state?.desktopAgentActive) {
        supersedeByDesktopAgent();
        return;
      }
    } catch {
      // State probe is best-effort; default to browser-scoped tracking.
    }

    attachMouseListeners();
    startCaptureService();
  })();

  emit();

  return {
    shiftId,
    requestCapture() {
      startCaptureService();
    },
    stop() {
      if (stopped) return;
      stopped = true;

      window.clearInterval(flushTimer);
      clearCaptureTimers();
      disarmGestureRetry();
      detachMouseListeners();
      video?.srcObject &&
        (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());

      // Best-effort final flush + session close; the server also closes the
      // monitoring session when the shift itself ends.
      void flushMouse(true).catch(() => undefined);
      void postJson(token, `/api/monitoring/session/${shiftId}/end`, { status: "completed" }, true)
        .catch(() => undefined);

      emit();
    },
  };
}

async function postJson(token: string, path: string, body: unknown, keepalive = false) {
  await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
    keepalive,
  });
}
