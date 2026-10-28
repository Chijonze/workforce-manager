"use client";

import Link from "next/link";
import { Download, Share, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { usePwaInstall } from "./usePwaInstall";

/**
 * Compact, dismissible installation prompt shown inside the authenticated app.
 * iOS never fires beforeinstallprompt, so it gets explicit Share → Add to Home
 * Screen instructions instead of a button that cannot work.
 */
export default function InstallBanner() {
  const { showBanner, platform, canPrompt, promptInstall, dismiss } = usePwaInstall();
  const [result, setResult] = useState("");

  if (!showBanner) return null;

  async function install() {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      dismiss();
      setResult("Installing…");
    } else if (outcome === "dismissed") {
      dismiss();
    } else {
      setResult("Use your browser menu to install.");
    }
  }

  return (
    <aside className="install-banner" aria-label="Install ShiftSync">
      <div className="install-banner-icon" aria-hidden="true">
        {platform === "ios" ? <Share size={18} /> : <Smartphone size={18} />}
      </div>

      <div className="install-banner-copy">
        <strong>Install ShiftSync</strong>
        {platform === "ios" ? (
          <span>
            In Safari, tap <Share size={12} aria-hidden="true" /> Share, then
            <b> Add to Home Screen</b> for full-screen access.
          </span>
        ) : (
          <span>
            Add ShiftSync to your home screen for faster, full-screen access.
            {result ? ` ${result}` : ""}
          </span>
        )}
        <Link className="install-banner-link" href="/install">
          Installation guide
        </Link>
      </div>

      {platform !== "ios" && canPrompt ? (
        <button className="button compact install-banner-action" type="button" onClick={install}>
          <Download size={15} />
          Install
        </button>
      ) : null}

      <button
        aria-label="Dismiss install prompt"
        className="icon-button install-banner-close"
        type="button"
        onClick={dismiss}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
