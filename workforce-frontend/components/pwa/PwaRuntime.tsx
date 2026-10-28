"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

/**
 * Registers the ShiftSync service worker and surfaces the two states that
 * matter on a phone: offline, and a waiting app update.
 *
 * The worker is only registered in a production build. During `next dev` the
 * hashed asset URLs change constantly and a cached shell would make hot reload
 * unreliable, so installability is verified with `next build && next start`.
 */
export default function PwaRuntime() {
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [applying, setApplying] = useState(false);
  const acceptedRef = useRef(false);
  const appliedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const sync = () => setOnline(window.navigator.onLine);
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let cleanupVisibility: (() => void) | undefined;
    let lastUpdateCheck = 0;

    const hadController = Boolean(navigator.serviceWorker.controller);

    // A reload only happens after the user accepts an update; the first-install
    // activation must not refresh the page underneath them.
    const handleControllerChange = () => {
      if (!acceptedRef.current) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;

        if (hadController && registration.waiting) {
          setWaitingWorker(registration.waiting);
        }

        const watchInstalling = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (cancelled) return;
            if (worker.state === "installed" && hadController) {
              setWaitingWorker(worker);
            }
          });
        };

        registration.addEventListener("updatefound", () => {
          watchInstalling(registration.installing);
        });
        watchInstalling(registration.installing);

        // Re-check for a new deployment when the installed app regains focus,
        // at most once every 30 minutes. No background polling.
        const onVisibility = () => {
          if (document.visibilityState !== "visible") return;
          if (Date.now() - lastUpdateCheck < 30 * 60 * 1000) return;
          lastUpdateCheck = Date.now();
          void registration.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", onVisibility);
        cleanupVisibility = () => document.removeEventListener("visibilitychange", onVisibility);
      })
      .catch(() => {
        // Registration failures are non-fatal: the web app keeps working online.
      });

    return () => {
      cancelled = true;
      cleanupVisibility?.();
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (appliedTimeoutRef.current) window.clearTimeout(appliedTimeoutRef.current);
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) return;

    acceptedRef.current = true;
    setApplying(true);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });

    // Fallback for browsers that do not emit controllerchange promptly.
    appliedTimeoutRef.current = window.setTimeout(() => {
      window.location.reload();
    }, 2500);
  }

  if (!mounted) return null;

  return (
    <>
      {!online && (
        <div className="pwa-offline-banner" role="status" aria-live="polite">
          <WifiOff size={16} />
          <span>{"You're offline. Workforce data can't refresh until you reconnect."}</span>
        </div>
      )}

      {waitingWorker && (
        <div className="pwa-update-banner" role="status" aria-live="polite">
          <div className="pwa-update-copy">
            <strong>Update available</strong>
            <span>A newer ShiftSync version is ready.</span>
          </div>
          <button className="button compact" disabled={applying} type="button" onClick={applyUpdate}>
            <RefreshCw size={15} />
            {applying ? "Updating…" : "Refresh"}
          </button>
        </div>
      )}
    </>
  );
}
