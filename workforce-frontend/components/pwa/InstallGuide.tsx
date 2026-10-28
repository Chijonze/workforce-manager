"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  MonitorSmartphone,
  MoreVertical,
  PlusSquare,
  Share,
  ShieldCheck,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { usePwaInstall, type PwaPlatform } from "@/components/pwa/usePwaInstall";

type GuideStep = { icon?: ReactNode; text: ReactNode };

function stepsFor(platform: PwaPlatform): GuideStep[] {
  if (platform === "ios") {
    return [
      { icon: <Share size={15} />, text: <>Open ShiftSync in <b>Safari</b> (not an in-app browser).</> },
      { icon: <Share size={15} />, text: <>Tap the <b>Share</b> button in the toolbar.</> },
      { icon: <PlusSquare size={15} />, text: <>Choose <b>Add to Home Screen</b>.</> },
      {
        text: (
          <>
            Confirm <b>Add</b>. If <b>Open as Web App</b> appears, keep it enabled.
          </>
        ),
      },
    ];
  }

  if (platform === "android") {
    return [
      { text: <>Open ShiftSync in <b>Chrome</b> (or another supported browser).</> },
      { icon: <MoreVertical size={15} />, text: <>Tap the <b>three-dot menu</b>.</> },
      {
        icon: <Download size={15} />,
        text: <>Choose <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</>,
      },
    ];
  }

  return [
    { text: <>Open ShiftSync in <b>Chrome</b> or <b>Edge</b> on desktop.</> },
    {
      icon: <Download size={15} />,
      text: <>Use the <b>install icon</b> in the address bar, or the browser menu&apos;s <b>Install</b> item.</>,
    },
    { text: <>Launch it from your applications list like any desktop app.</> },
  ];
}

export default function InstallGuide() {
  const { mounted, standalone, platform, canPrompt, promptInstall } = usePwaInstall();
  // Default to "other" until mounted so server and first client render agree;
  // the detected platform replaces it immediately after hydration.
  const activePlatform: PwaPlatform = mounted ? platform : "other";
  const steps = stepsFor(activePlatform);
  const platformLabel =
    activePlatform === "ios"
      ? "iPhone / iPad"
      : activePlatform === "android"
        ? "Android"
        : activePlatform === "desktop"
          ? "Desktop"
          : "Your device";

  async function install() {
    await promptInstall();
  }

  return (
    <main className="install-page">
      <div className="install-topbar">
        <Link className="install-back" href="/">
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>
        <img alt="ShiftSync" className="install-logo" src="/shiftsync-logo.png" />
      </div>

      <section className="install-hero">
        <div className="install-hero-mark">
          <img alt="" src="/icons/icon-192.png" />
        </div>
        <div className="install-hero-copy">
          <span className="install-eyebrow">Mobile access</span>
          <h1>Install ShiftSync on your phone</h1>
          <p>
            No App Store or Google Play download. Add the existing workforce portal to
            your home screen for a full-screen, app-like experience with the same secure
            sign-in and permissions you already use.
          </p>

          <div className="install-hero-actions">
            {standalone ? (
              <span className="pill success-pill install-state-pill">
                <CheckCircle2 size={14} />
                Installed on this device
              </span>
            ) : (
              <>
                {activePlatform !== "ios" && canPrompt ? (
                  <button className="button" type="button" onClick={() => void install()}>
                    <Download size={17} />
                    Install now
                  </button>
                ) : null}
                <a className="button secondary" href="#install-steps">
                  <Smartphone size={17} />
                  Show me the steps
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="install-grid" id="install-steps">
        <article className="panel install-card">
          <div className="install-card-head">
            <Smartphone size={18} />
            <h2>{platformLabel} installation</h2>
            {mounted && activePlatform === platform ? (
              <span className="pill success-pill">Detected</span>
            ) : null}
          </div>
          <ol className="install-steps">
            {steps.map((step, index) => (
              <li key={index}>
                <span className="install-step-number">{index + 1}</span>
                <span className="install-step-text">
                  {step.icon ? <span className="install-step-icon">{step.icon}</span> : null}
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="install-card-note">
            On iPhone and iPad, only Safari can add the app to the Home Screen. Chrome on
            iOS cannot install PWAs or Chrome extensions.
          </p>
        </article>

        <article className="panel install-card">
          <div className="install-card-head">
            <MonitorSmartphone size={18} />
            <h2>Other platforms</h2>
          </div>
          <dl className="install-facts">
            <div>
              <dt>Android</dt>
              <dd>Chrome menu → Install app, or the native install prompt.</dd>
            </div>
            <div>
              <dt>iPhone / iPad</dt>
              <dd>Safari → Share → Add to Home Screen → Add.</dd>
            </div>
            <div>
              <dt>Desktop</dt>
              <dd>Chrome or Edge address-bar install button.</dd>
            </div>
            <div>
              <dt>Chrome extension</dt>
              <dd>Optional desktop Chrome/Edge companion, installed separately. Not available on iOS.</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="install-notes">
        <div className="install-note">
          <ShieldCheck size={18} />
          <div>
            <strong>Same secure sign-in</strong>
            <span>
              MFA, account approval and role permissions are unchanged in the installed app.
              The service worker never caches API responses, tokens, reports or workforce data.
            </span>
          </div>
        </div>
        <div className="install-note">
          <WifiOff size={18} />
          <div>
            <strong>Limited offline behaviour</strong>
            <span>
              Only the app shell and a friendly offline page are cached. Attendance, monitoring,
              leave and reports require a live connection.
            </span>
          </div>
        </div>
        <div className="install-note">
          <Download size={18} />
          <div>
            <strong>Updates are automatic</strong>
            <span>
              New versions are detected when the app regains focus. You will be offered a
              refresh instead of being served stale assets.
            </span>
          </div>
        </div>
      </section>

      <p className="install-footnote">
        Already installed? Open ShiftSync from your Home Screen or applications list. To remove
        it, uninstall it the same way as any other app.
      </p>
    </main>
  );
}
