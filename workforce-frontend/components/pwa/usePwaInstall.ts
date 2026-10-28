"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PwaPlatform = "ios" | "android" | "desktop" | "other";
export type InstallPromptOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "shiftsync_install_prompt_dismissed_until";
const DISMISS_DAYS = 14;

export function detectPwaPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent;
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/i.test(ua) || isIpadOs) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;

  const displayMode = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iOSStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;

  return Boolean(displayMode || iOSStandalone);
}

/**
 * Install state shared by the install banner, the PWA status chip and the
 * /install guide. Dismissals are persisted for 14 days so the prompt does not
 * nag on every launch; standalone mode always suppresses it entirely.
 */
export function usePwaInstall() {
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("other");
  const [canPrompt, setCanPrompt] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    setStandalone(isStandaloneDisplay());
    setPlatform(detectPwaPlatform());

    try {
      const stored = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      if (Number.isFinite(stored) && stored > 0) setDismissedUntil(stored);
    } catch {
      // Private browsing/storage disabled: fall back to the session's default.
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    const onInstalled = () => {
      promptRef.current = null;
      setCanPrompt(false);
      setStandalone(true);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        // Ignore storage failures.
      }
    };

    const media = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => setStandalone(isStandaloneDisplay());

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media?.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallPromptOutcome> => {
    const event = promptRef.current;
    if (!event) return "unavailable";

    try {
      await event.prompt();
      const choice = await event.userChoice;
      promptRef.current = null;
      setCanPrompt(false);
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, []);

  const dismiss = useCallback(() => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    setDismissedUntil(until);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // Dismissal still applies for this page load.
    }
  }, []);

  const showBanner = mounted && !standalone && Date.now() > dismissedUntil;

  return {
    mounted,
    standalone,
    platform,
    canPrompt,
    showBanner,
    promptInstall,
    dismiss,
  };
}
