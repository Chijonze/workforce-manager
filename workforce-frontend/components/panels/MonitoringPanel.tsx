"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3,
  ImageOff,
  MousePointer2,
  Camera,
  RefreshCw,
} from "lucide-react";
import { apiRequest, formatDateTime, formatDate, getApiUrl } from "@/lib/api";
import type {
  MonitoringCapture,
  MonitoringDetail,
  MonitoringSummary,
  User,
} from "@/types/workforce";

function formatDistance(px: number) {
  const meters = px / 96 * 2.54 / 100; // assume ~96dpi
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  if (meters >= 1) return `${meters.toFixed(1)} m`;
  return `${Math.round(meters * 100)} cm`;
}

function MouseSparkline({ samples }: { samples: { at: string; movements: number }[] }) {
  if (samples.length < 2) {
    return <p className="muted">Not enough mouse data recorded yet for a timeline.</p>;
  }

  const width = 640;
  const height = 80;
  const max = Math.max(...samples.map((sample) => sample.movements), 1);
  const step = width / (samples.length - 1);
  const points = samples
    .map((sample, index) => `${(index * step).toFixed(1)},${(height - (sample.movements / max) * (height - 8)).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      aria-label="Mouse movements over the shift"
      className="mouse-sparkline"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline fill="none" points={points} stroke="var(--primary)" strokeWidth="2" />
    </svg>
  );
}

function CaptureThumb({
  capture,
  error,
  url,
  onVisible,
}: {
  capture: MonitoringCapture;
  error: boolean;
  url?: string;
  onVisible: (captureId: string) => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const sizeLabel = capture.sizeBytes
    ? `${Math.max(1, Math.round(capture.sizeBytes / 1000))} KB`
    : null;

  // Load each screenshot only when its card approaches the viewport. This is
  // what lets the gallery show every capture in the shift (not just the first
  // ten) without downloading dozens of images up front.
  useEffect(() => {
    if (url || error || imageFailed) return;

    const node = cardRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      onVisible(capture._id);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          onVisible(capture._id);
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [capture._id, error, imageFailed, onVisible, url]);

  return (
    <figure className="capture-card" ref={cardRef}>
      {url && !imageFailed ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            alt={`Screenshot ${capture.seq} at ${formatDateTime(capture.capturedAt)}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={url}
          />
        </a>
      ) : (
        <div className="capture-loading">
          {error || imageFailed ? <ImageOff size={16} /> : <span>Loading…</span>}
        </div>
      )}
      <figcaption>
        #{capture.seq} · {formatDateTime(capture.capturedAt)}
        {sizeLabel ? ` · ${sizeLabel}` : ""}
        {capture.source === "desktop" && (
          <span className="pill accent-pill capture-source-pill">Desktop</span>
        )}
      </figcaption>
    </figure>
  );
}

export default function MonitoringPanel({
  agents,
  initialAgentId,
  token,
}: {
  agents: User[];
  initialAgentId?: string;
  token: string;
}) {
  const [agentId, setAgentId] = useState("");
  const [sessions, setSessions] = useState<MonitoringSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MonitoringDetail | null>(null);
  const [captureUrls, setCaptureUrls] = useState<Record<string, string>>({});
  const [captureErrors, setCaptureErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const urlsRef = useRef<Record<string, string>>({});
  const loadingCapturesRef = useRef<Set<string>>(new Set());
  const captureGenerationRef = useRef(0);
  const detailRef = useRef<string | null>(null);
  const appliedInitialAgentRef = useRef("");

  useEffect(() => {
    // A team member tapped on the mobile dashboard opens their data directly.
    // Apply each requested id once so manual changes in the select stick.
    if (
      initialAgentId &&
      initialAgentId !== appliedInitialAgentRef.current &&
      agents.some((agent) => agent._id === initialAgentId)
    ) {
      appliedInitialAgentRef.current = initialAgentId;
      setAgentId(initialAgentId);
      return;
    }

    if (agentId || !agents.length) return;
    setAgentId(agents[0]._id);
  }, [agentId, agents, initialAgentId]);

  const releaseUrls = useCallback(() => {
    captureGenerationRef.current += 1;
    Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
    loadingCapturesRef.current.clear();
    setCaptureUrls({});
    setCaptureErrors({});
  }, []);

  // Authorized blob fetch for one capture. <img> tags cannot send bearer
  // tokens, so each card fetches its own image as it scrolls into view.
  const loadCapture = useCallback(async (captureId: string) => {
    if (!captureId || urlsRef.current[captureId] || loadingCapturesRef.current.has(captureId)) {
      return;
    }

    loadingCapturesRef.current.add(captureId);
    const generation = captureGenerationRef.current;

    try {
      const response = await fetch(
        `${getApiUrl()}/api/monitoring/captures/${captureId}/file`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (generation !== captureGenerationRef.current) return;

      if (!response.ok) {
        setCaptureErrors((current) => ({ ...current, [captureId]: true }));
        return;
      }

      const blob = await response.blob();
      if (generation !== captureGenerationRef.current) return;

      const url = URL.createObjectURL(blob);
      if (generation !== captureGenerationRef.current) {
        URL.revokeObjectURL(url);
        return;
      }

      urlsRef.current[captureId] = url;
      setCaptureUrls((current) => ({ ...current, [captureId]: url }));
    } catch {
      if (generation === captureGenerationRef.current) {
        setCaptureErrors((current) => ({ ...current, [captureId]: true }));
      }
    } finally {
      loadingCapturesRef.current.delete(captureId);
    }
  }, [token]);

  const loadSessions = useCallback(async () => {
    if (!agentId) return;

    setLoading(true);
    setError("");
    setDetail(null);
    setSelectedSessionId(null);
    releaseUrls();

    try {
      const list = await apiRequest<MonitoringSummary[]>(`/api/monitoring/user/${agentId}/shifts?limit=15`, {
        token,
      });
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load monitoring data");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, releaseUrls, token]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session._id === selectedSessionId) || null,
    [selectedSessionId, sessions]
  );

  useEffect(() => {
    const shiftId = selectedSession?.shiftSessionId;

    if (!shiftId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiRequest<MonitoringDetail>(`/api/monitoring/shift/${shiftId}`, { token })
      .then((result) => {
        if (cancelled) return;
        releaseUrls();
        setDetail(result);
        detailRef.current = shiftId;
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load monitoring detail");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [releaseUrls, selectedSession?.shiftSessionId, token]);

  useEffect(() => releaseUrls, [releaseUrls]);

  const monitoring = detail?.monitoring;
  const mouse = monitoring?.mouseTotals;

  return (
    <section className="panel monitoring-panel">
      <div className="panel-header">
        <div className="panel-title">
          <MousePointer2 size={20} />
          <div>
            <h2>Activity Monitoring</h2>
            <p className="panel-subtitle">Mouse tracking and automatic screenshots recorded during shifts</p>
          </div>
        </div>
        <button className="icon-button secondary" title="Refresh" type="button" onClick={() => void loadSessions()}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="overview-filters">
        <label>Agent
          <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            {agents.length ? (
              agents.map((agent) => (
                <option key={agent._id} value={agent._id}>
                  {agent.name} ({agent.email})
                </option>
              ))
            ) : (
              <option value="">No agents available</option>
            )}
          </select>
        </label>
        <label>Shift
          <select
            value={selectedSessionId || ""}
            onChange={(event) => setSelectedSessionId(event.target.value || null)}
            disabled={!sessions.length}
          >
            {sessions.length ? (
              sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {formatDate(session.shift?.clockInTime || session.startedAt)} ·{" "}
                  {session.shift?.totalWorkedMinutes ?? 0}m worked · {session.captureCount} captures
                </option>
              ))
            ) : (
              <option value="">No monitored shifts recorded</option>
            )}
          </select>
        </label>
      </div>

      {error && <p className="validation-copy">{error}</p>}

      {!detail && !loading && !error && (
        <p className="muted">
          Select a shift to review its recorded mouse activity and screenshots. Monitoring data
          appears here once agents work a shift with the new activity tracking active.
        </p>
      )}

      {monitoring && mouse && (
        <div className="monitoring-detail">
          <div className="metrics admin-metrics">
            <div className="metric">
              <span>Screenshots</span>
              <strong>
                {monitoring.captures.length}
                <small> / {monitoring.capturePlan} planned</small>
              </strong>
            </div>
            <div className="metric">
              <span>Mouse movements</span>
              <strong>{mouse.movements.toLocaleString()}</strong>
            </div>
            <div className="metric">
              <span>Pointer distance</span>
              <strong>{formatDistance(mouse.distancePx)}</strong>
            </div>
            <div className="metric">
              <span>Clicks</span>
              <strong>{mouse.clicks.toLocaleString()}</strong>
            </div>
            <div className="metric">
              <span>Scrolls</span>
              <strong>{mouse.scrolls.toLocaleString()}</strong>
            </div>
            <div className="metric">
              <span>Tracked minutes</span>
              <strong>{mouse.sampleCount}</strong>
            </div>
            <div className="metric">
              <span>Session</span>
              <strong>
                {formatDate(monitoring.startedAt)}
                <small>
                  {" "}
                  {new Date(monitoring.startedAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {monitoring.status === "active" ? " · running" : ` · ${monitoring.status}`}
                </small>
              </strong>
            </div>
            <div className="metric">
              <span>Mode</span>
              <strong>{monitoring.scheduleType === "fluid" ? "Fluid" : "Time managed"}</strong>
            </div>
          </div>

          <div className="monitoring-chart-block">
            <div className="record-row">
              <span><Clock3 size={14} /> Mouse movements per minute</span>
              <span className="muted">{detail?.shift?.clockInTime ? formatDateTime(detail.shift.clockInTime) : ""}</span>
            </div>
            <MouseSparkline samples={monitoring.mouseSamples} />
          </div>

          <div className="capture-gallery-block">
            <div className="record-row">
              <span><Camera size={14} /> Automatic screenshots</span>
              <span className="muted">
                {monitoring.captures.length
                  ? "Click a screenshot to open it full size — all captures load as you scroll"
                  : monitoring.status === "active"
                    ? "No screenshots yet — one is taken every 15 minutes during the shift"
                    : "No screenshots were captured in this shift"}
              </span>
            </div>

            {monitoring.captures.length ? (
              <div className="capture-gallery">
                {monitoring.captures.map((capture) => (
                  <CaptureThumb
                    capture={capture}
                    error={Boolean(captureErrors[capture._id])}
                    key={capture._id}
                    onVisible={loadCapture}
                    url={captureUrls[capture._id]}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
