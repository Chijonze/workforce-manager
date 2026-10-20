"use client";

import { getApiUrl } from "./api";

export type MonitoringStats = {
  shiftId: string;
  running: boolean;
  captureIntervalMinutes: number;
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
  onState: (stats: MonitoringStats) => void;
};

const MOUSE_FLUSH_MS = 60_000;
const MAX_CAPTURE_WIDTH = 1280;
// Every stored screenshot must stay under this budget. WebP keeps text
// readable at a fraction of the JPEG size, so quality can stay high.
const CAPTURE_TARGET_BYTES = 300 * 1000;
// Fixed cadence, overridable by the server until clients catch up.
const DEFAULT_CAPTURE_INTERVAL_MS = 15 * 60_000;
const MIN_CAPTURE_INTERVAL_MS = 60_000;
// Proof-of-life capture shortly after the worker goes Available (or re-enables
// screen capture mid-shift) so the pipeline is visible immediately instead of
// one full interval later.
const FIRST_CAPTURE_DELAY_MS = 60_000;
// Fire just after a slot boundary so a small clock/network skew still records
// the capture inside the intended 15-minute window.
const CAPTURE_SLOT_OFFSET_MS = 750;

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

let webpEncodingSupported: boolean | null = null;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function detectWebpEncoding() {
  if (webpEncodingSupported !== null) return webpEncodingSupported;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const blob = await canvasToBlob(canvas, "image/webp", 0.5);
    webpEncodingSupported = Boolean(blob && blob.type === "image/webp");
  } catch {
    webpEncodingSupported = false;
  }

  return webpEncodingSupported;
}

function scaleCanvas(source: HTMLCanvasElement, width: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(source.height * (canvas.width / source.width)));

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas;
}

type EncodedCapture = { blob: Blob; width: number; height: number };

/**
 * Encodes a canvas under the 300KB budget.
 *
 * WebP is preferred (Chrome/Edge/Firefox, and Safari 16+ for encoding) because
 * it preserves small UI text far better than JPEG at the same byte count.
 * Quality starts high and only steps down when a dense screen would break the
 * budget; if even the lowest quality is too large, the frame is downscaled a
 * step at a time. The first encode under budget wins, so a normal dashboard
 * capture keeps the top quality setting.
 */
async function encodeCapture(source: HTMLCanvasElement): Promise<EncodedCapture | null> {
  const useWebp = await detectWebpEncoding();
  const mimeType = useWebp ? "image/webp" : "image/jpeg";
  const qualities = useWebp
    ? [0.9, 0.82, 0.74, 0.66, 0.58]
    : [0.86, 0.78, 0.7, 0.62, 0.54];
  const widths = [
    source.width,
    Math.round(source.width * 0.85),
    Math.round(source.width * 0.7),
    Math.round(source.width * 0.55),
  ].filter((width, index, list) => width >= 480 && list.indexOf(width) === index);

  let smallest: EncodedCapture | null = null;

  for (const width of widths) {
    const canvas = width === source.width ? source : scaleCanvas(source, width);
    if (!canvas) continue;

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, mimeType, quality);
      if (!blob) continue;

      const candidate = { blob, width: canvas.width, height: canvas.height };

      if (!smallest || blob.size < smallest.blob.size) smallest = candidate;

      if (blob.size <= CAPTURE_TARGET_BYTES) return candidate;
    }
  }

  return smallest;
}

/**
 * Runs worker activity monitoring for one shift:
 *  - mouse tracking (aggregated per minute, from "Available" to "End shift")
 *  - an automatic screenshot every 15 minutes over the same window, for both
 *    time-managed and fluid shifts
 *
 * If the worker's desktop agent (Electron) connects, the server hands the
 * shift over to it for desktop-wide tracking; this page then stands down and
 * probes once a minute, resuming browser-scoped tracking if the agent leaves.
 *
 * Deliberately frugal: counters instead of event streams, one small upload per
 * minute, a single reused canvas, and one WebP screenshot per 15 minutes of
 * shift that is compressed to stay under 300KB.
 */
export function createMonitoringSession(options: EngineOptions): MonitoringHandle {
  const { token, shiftId, onState } = options;

  let stopped = false;
  let captureIntervalMs = DEFAULT_CAPTURE_INTERVAL_MS;
  let capturesTaken = 0;
  let capturesEnabled = false;
  let captureNotice: string | null = null;
  let viaDesktopAgent = false;
  let canRetryCapture = false;
  let gestureRetryArmed = false;
  let captureInFlight = false;
  let captureRequestPending = false;
  // Capture slots are aligned to the monitoring session's start time so a
  // reload, a late screen-share grant, or a desktop-handover cannot shift the
  // cadence and produce a different screenshot count than another worker.
  let startedAtMs = Date.now();
  let bucket = emptyBucket();
  const totals = { movements: 0, distancePx: 0, clicks: 0, scrolls: 0 };

  const flushTimer = window.setInterval(() => void flushTick(), MOUSE_FLUSH_MS);
  let captureTimer: number | null = null;
  let firstCaptureTimer: number | null = null;

  const emit = () => {
    onState({
      shiftId,
      running: !stopped,
      captureIntervalMinutes: Math.round(captureIntervalMs / 60_000),
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

  function clearCaptureTimer() {
    if (captureTimer !== null) {
      window.clearTimeout(captureTimer);
      captureTimer = null;
    }
    if (firstCaptureTimer !== null) {
      window.clearTimeout(firstCaptureTimer);
      firstCaptureTimer = null;
    }
  }

  function applyCaptureInterval(minutes: unknown) {
    const parsed = Math.round(Number(minutes) || 0);
    if (parsed > 0) {
      captureIntervalMs = Math.max(MIN_CAPTURE_INTERVAL_MS, parsed * 60_000);
    }
  }

  function applyStartedAt(value: unknown) {
    if (typeof value !== "string") return;

    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) startedAtMs = parsed;
  }

  // Once the worker's desktop agent reports in, it owns desktop-wide tracking
  // and the remaining screenshot cadence; the browser page stands down so data
  // is not double-counted.
  function supersedeByDesktopAgent() {
    if (viaDesktopAgent) return;

    viaDesktopAgent = true;
    capturesEnabled = false;
    canRetryCapture = false;
    captureNotice = "Desktop agent is handling tracking and screenshots";
    clearCaptureTimer();
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
      if (!response.ok) return;

      const data = await response.json().catch(() => ({}));

      if (stopped) return;

      applyStartedAt(data?.startedAt);

      if (data?.desktopAgentActive) {
        // The agent may have connected after this page started; stand down.
        supersedeByDesktopAgent();
        return;
      }

      if (!viaDesktopAgent) return;

      // The desktop agent is gone: resume browser-scoped tracking with the
      // server's capture count as the baseline. Do not re-prompt for screen
      // access when the worker has already declined; the dashboard exposes an
      // explicit retry button for that case.
      viaDesktopAgent = false;
      applyCaptureInterval(data?.captureIntervalMinutes);
      capturesTaken = Math.max(Number(data?.captureCount) || 0, capturesTaken);
      attachMouseListeners();
      if (!capturesEnabled && !canRetryCapture) startCaptureService();
      emit();
    } catch {
      // Keep probing; the next tick retries.
    }
  }

  function msUntilNextCaptureSlot() {
    const elapsed = Math.max(0, Date.now() - startedAtMs);
    const nextSlot = (Math.floor(elapsed / captureIntervalMs) + 1) * captureIntervalMs;
    return Math.max(1_000, nextSlot - elapsed + CAPTURE_SLOT_OFFSET_MS);
  }

  function scheduleNextCadenceCapture() {
    if (stopped || !capturesEnabled || viaDesktopAgent || captureTimer !== null) return;

    captureTimer = window.setTimeout(() => {
      captureTimer = null;
      void takeCadenceCapture().finally(scheduleNextCadenceCapture);
    }, msUntilNextCaptureSlot());
  }

  // One screenshot per cadence slot, from when capture starts (the worker
  // going Available) until the shift ends. The tick is a no-op while screen
  // capture is unavailable, so a late permission grant just rejoins the beat.
  function startCaptureCadence() {
    if (captureTimer !== null || firstCaptureTimer !== null) return;

    // Only take the early proof-of-life shot when this shift has no captures
    // yet; a resumed page/agent must wait for the next slot instead of adding
    // an extra screenshot.
    if (capturesTaken === 0) {
      firstCaptureTimer = window.setTimeout(() => {
        firstCaptureTimer = null;
        void takeCadenceCapture().finally(scheduleNextCadenceCapture);
      }, FIRST_CAPTURE_DELAY_MS);
      return;
    }

    scheduleNextCadenceCapture();
  }

  async function takeCadenceCapture() {
    if (stopped || !capturesEnabled || viaDesktopAgent || captureInFlight) return;

    const videoEl = video;
    if (!videoEl) return;

    captureInFlight = true;

    try {
      await videoEl.play();
      // Give the freshly resumed stream one frame before painting the canvas.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      await captureFromVideo();
    } catch {
      // A blocked autoplay or a transient capture failure is retried on the
      // next cadence slot.
    } finally {
      videoEl.pause();
      captureInFlight = false;
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

      if (!stopped && data?.desktopAgentActive) {
        supersedeByDesktopAgent();
      }
    } catch {
      // Monitoring data is best-effort; a failed batch is simply dropped.
    }
  }

  // Probe every minute even when the worker is idle: mouse batches stop while
  // there is no movement, and a desktop handover must still be noticed before
  // the next capture slot.
  async function flushTick() {
    if (stopped) return;

    await probeDesktopAgent();

    if (!viaDesktopAgent) await flushMouse(false);
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

    const encoded = await encodeCapture(canvasEl);
    if (!encoded || stopped) return;

    // The route parses a raw octet-stream; the server sniffs JPEG/PNG/WebP and
    // re-encodes to WebP under 300KB, so the content type stays generic here.
    const response = await fetch(
      `${getApiUrl()}/api/monitoring/session/${shiftId}/capture?width=${encoded.width}&height=${encoded.height}&protocol=2`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Authorization: `Bearer ${token}`,
        },
        body: encoded.blob,
      }
    );

    if (!response.ok || stopped) return;

    const data = await response.json().catch(() => ({}));
    capturesTaken = typeof data?.captureCount === "number" ? data.captureCount : capturesTaken + 1;
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
    if (stopped || viaDesktopAgent || capturesEnabled || captureRequestPending) return;

    if (!navigator.mediaDevices?.getDisplayMedia) {
      captureNotice = "Screen capture is not supported in this browser";
      emit();
      return;
    }

    captureRequestPending = true;

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
          clearCaptureTimer();
          emit();
        });

        startCaptureCadence();
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
      })
      .finally(() => {
        captureRequestPending = false;
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

      applyCaptureInterval(data.captureIntervalMinutes);
      applyStartedAt(data.startedAt);
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

      applyStartedAt(state?.startedAt);

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

      // Start the final flush before flipping `stopped`, otherwise the flush
      // guard would drop the worker's last partial minute of activity. The
      // shift lifecycle owns closing the monitoring session, so a page unload
      // or reload does not disable screenshots for the rest of the shift.
      void flushMouse(true).catch(() => undefined);

      stopped = true;
      window.clearInterval(flushTimer);
      clearCaptureTimer();
      disarmGestureRetry();
      detachMouseListeners();
      video?.srcObject &&
        (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());

      emit();
    },
  };
}
