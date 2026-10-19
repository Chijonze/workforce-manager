"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pdf } from "@react-pdf/renderer";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Download,
  FileText,
  Home,
  RefreshCw,
  ScanEye,
  Sparkles,
  Users,
} from "lucide-react";
import { apiRequest, formatDate, formatDateTime, getApiUrl } from "@/lib/api";
import type {
  AggregateAnalysis,
  AnalysisOverview,
  AnalysisWorker,
  AnalysisWorkerShift,
  ShiftAnalysis,
  User,
} from "@/types/workforce";
import { dateKeyFromParts, londonDateParts } from "@/components/shared";
import { formatMinutes } from "@/lib/charts";
import { BarChart, PieChart, ScoreDonut } from "@/components/charts/Charts";
import { AIAnalysisPDF, buildAnalysisPdfData } from "@/components/AIAnalysisPDF";
import { AggregateAnalysisPDF, buildAggregatePdfData } from "@/components/AggregateAnalysisPDF";

const MAX_PDF_CAPTURES = 4;

async function fetchLogoDataUri(): Promise<string | undefined> {
  try {
    const response = await fetch("/avs-invoice-logo.jpg");
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function fetchCaptureDataUri(token: string, captureId: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${getApiUrl()}/api/monitoring/captures/${captureId}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

const londonParts = londonDateParts();
const TODAY_KEY = dateKeyFromParts(londonParts.year, londonParts.month, londonParts.day);
const MONTH_START_KEY = dateKeyFromParts(londonParts.year, londonParts.month, 1);

type AnalysisMode = "shift" | "aggregate";

export default function AiAnalysisPage() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "supervisor" | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("shift");

  const [overview, setOverview] = useState<AnalysisOverview | null>(null);
  const [workers, setWorkers] = useState<AnalysisWorker[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [shifts, setShifts] = useState<AnalysisWorkerShift[]>([]);
  const [shiftId, setShiftId] = useState("");
  const [analysis, setAnalysis] = useState<ShiftAnalysis | null>(null);
  const [capturePreviews, setCapturePreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [aggStart, setAggStart] = useState(MONTH_START_KEY);
  const [aggEnd, setAggEnd] = useState(TODAY_KEY);
  const [aggregate, setAggregate] = useState<AggregateAnalysis | null>(null);
  const [aggLoading, setAggLoading] = useState(false);
  const [aggGenerating, setAggGenerating] = useState(false);
  const [aggDownloading, setAggDownloading] = useState(false);

  const [hiringManagers, setHiringManagers] = useState<User[]>([]);
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [error, setError] = useState("");

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker._id === workerId),
    [workers, workerId]
  );
  const selectedHiringManager = hiringManagers.find(
    (manager) => manager._id === hiringManagerId
  );

  const loadOverview = useCallback(async (authToken: string) => {
    try {
      setOverview(await apiRequest<AnalysisOverview>("/api/analysis/overview", { token: authToken }));
    } catch {
      /* Header aggregates are non-critical. */
    }
  }, []);

  const loadWorkers = useCallback(async (authToken: string) => {
    const list = await apiRequest<AnalysisWorker[]>("/api/analysis/workers", { token: authToken });
    setWorkers(list);
    return list;
  }, []);

  const loadShifts = useCallback(async (authToken: string, targetWorkerId: string) => {
    const list = await apiRequest<AnalysisWorkerShift[]>(
      `/api/analysis/workers/${targetWorkerId}/shifts`,
      { token: authToken }
    );
    setShifts(list);
    return list;
  }, []);

  const loadAnalysis = useCallback(async (authToken: string, targetShiftId: string) => {
    setCapturePreviews({});
    try {
      const data = await apiRequest<ShiftAnalysis>(`/api/analysis/shift/${targetShiftId}`, {
        token: authToken,
      });
      setAnalysis(data);
      return data;
    } catch (err) {
      if (err instanceof Error && /not found|No analysis/i.test(err.message)) {
        setAnalysis(null);
        return null;
      }
      throw err;
    }
  }, []);

  const loadAggregate = useCallback(
    async (authToken: string, start: string, end: string) => {
      const data = await apiRequest<AggregateAnalysis>(
        `/api/analysis/aggregate?startDate=${start}&endDate=${end}`,
        { token: authToken }
      );
      setAggregate(data);
      return data;
    },
    []
  );

  useEffect(() => {
    const savedToken = window.localStorage.getItem("workforce_token");
    if (!savedToken) {
      setError("Sign in as an admin or hiring manager to view AI analyses.");
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const currentUser = await apiRequest<User>("/api/auth/me", { token: savedToken });
        if (currentUser.role !== "admin" && currentUser.role !== "supervisor") {
          throw new Error("AI analyses are only available to admins and hiring managers.");
        }
        setToken(savedToken);
        setRole(currentUser.role);
        const [workerList, allUsers] = await Promise.all([
          loadWorkers(savedToken),
          apiRequest<User[]>("/api/auth/users", { token: savedToken }),
        ]);
        setHiringManagers(
          allUsers
            .filter((user) => user.role === "supervisor" && user.accountStatus !== "pending")
            .sort((left, right) => left.name.localeCompare(right.name))
        );
        await loadOverview(savedToken);
        if (workerList.length) {
          setWorkerId(workerList[0]._id);
          const shiftList = await loadShifts(savedToken, workerList[0]._id);
          if (shiftList.length) {
            setShiftId(shiftList[0].shiftId);
            await loadAnalysis(savedToken, shiftList[0].shiftId);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load AI analyses.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadAnalysis, loadOverview, loadShifts, loadWorkers]);

  // Screenshot evidence thumbnails for the on-screen strip.
  useEffect(() => {
    const captures = analysis?.metrics.captures.slice(-MAX_PDF_CAPTURES) || [];
    if (!token || !captures.length) return;

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        captures.map(async (capture) => [
          capture.captureId,
          await fetchCaptureDataUri(token, capture.captureId),
        ] as const)
      );
      if (cancelled) return;
      setCapturePreviews(
        Object.fromEntries(
          entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [analysis, token]);

  async function selectWorker(nextWorkerId: string) {
    if (!token) return;
    setWorkerId(nextWorkerId);
    setShiftId("");
    setShifts([]);
    setAnalysis(null);
    setError("");
    setLoading(true);
    try {
      const list = await loadShifts(token, nextWorkerId);
      if (list.length) {
        setShiftId(list[0].shiftId);
        await loadAnalysis(token, list[0].shiftId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shifts for this worker.");
    } finally {
      setLoading(false);
    }
  }

  async function selectShift(nextShiftId: string) {
    if (!token) return;
    setShiftId(nextShiftId);
    setError("");
    setLoading(true);
    try {
      await loadAnalysis(token, nextShiftId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the analysis for this shift.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AnalysisMode) {
    setMode(nextMode);
    if (nextMode === "aggregate" && token && !aggregate && !aggLoading) {
      void (async () => {
        setAggLoading(true);
        setError("");
        try {
          await loadAggregate(token, aggStart, aggEnd);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not load the aggregate analysis.");
        } finally {
          setAggLoading(false);
        }
      })();
    }
  }

  async function applyAggregatePeriod() {
    if (!token) return;
    setAggLoading(true);
    setError("");
    try {
      await loadAggregate(token, aggStart, aggEnd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the aggregate analysis.");
    } finally {
      setAggLoading(false);
    }
  }

  async function refreshAll() {
    if (!token) return;
    setLoading(mode === "shift");
    setAggLoading(mode === "aggregate");
    setError("");
    try {
      await Promise.all([loadOverview(token), loadWorkers(token)]);
      if (mode === "shift" && workerId) {
        const list = await loadShifts(token, workerId);
        if (shiftId && list.some((shift) => shift.shiftId === shiftId)) {
          await loadAnalysis(token, shiftId);
        } else if (list.length) {
          setShiftId(list[0].shiftId);
          await loadAnalysis(token, list[0].shiftId);
        } else {
          setShiftId("");
          setAnalysis(null);
        }
      }
      if (mode === "aggregate") {
        await loadAggregate(token, aggStart, aggEnd);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh AI analyses.");
    } finally {
      setLoading(false);
      setAggLoading(false);
    }
  }

  async function generateAnalysis() {
    if (!token || !shiftId) return;
    setGenerating(true);
    setError("");
    try {
      const data = await apiRequest<ShiftAnalysis>(`/api/analysis/shift/${shiftId}/generate`, {
        method: "POST",
        token,
        body: { force: true },
      });
      setAnalysis(data);
      await Promise.all([loadOverview(token), loadShifts(token, workerId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the AI analysis.");
    } finally {
      setGenerating(false);
    }
  }

  async function generatePeriodSummary() {
    if (!token) return;
    setAggGenerating(true);
    setError("");
    try {
      await apiRequest<AggregateAnalysis["narrative"]>("/api/analysis/aggregate/narrative", {
        method: "POST",
        token,
        body: { startDate: aggStart, endDate: aggEnd, force: true },
      });
      await loadAggregate(token, aggStart, aggEnd);
      await loadOverview(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the period summary.");
    } finally {
      setAggGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!analysis || !selectedHiringManager || !token) return;
    setDownloading(true);
    setError("");
    try {
      const logoSrc = await fetchLogoDataUri();
      const captures = analysis.metrics.captures.slice(-MAX_PDF_CAPTURES);
      const captureImages: Record<string, string> = {};
      for (const capture of captures) {
        const uri = capturePreviews[capture.captureId] || (await fetchCaptureDataUri(token, capture.captureId));
        if (uri) captureImages[capture.captureId] = uri;
      }

      const data = buildAnalysisPdfData({
        analysis,
        worker: selectedWorker
          ? { name: selectedWorker.name, email: selectedWorker.email }
          : { name: "Unknown worker", email: "" },
        hiringManager: selectedHiringManager,
        logoSrc,
        captureImages,
      });
      const blob = await pdf(<AIAnalysisPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-shift-analysis-${analysis.workDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the PDF report.");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadAggregatePdf() {
    if (!aggregate || !selectedHiringManager) return;
    setAggDownloading(true);
    setError("");
    try {
      const logoSrc = await fetchLogoDataUri();
      const data = buildAggregatePdfData({
        aggregate,
        hiringManager: selectedHiringManager,
        logoSrc,
      });
      const blob = await pdf(<AggregateAnalysisPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-period-analysis-${aggStart}-to-${aggEnd}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the PDF report.");
    } finally {
      setAggDownloading(false);
    }
  }

  const shiftDownloadReady = Boolean(analysis);
  const aggregateDownloadReady = Boolean(aggregate?.rows.length);
  const downloadDisabled =
    mode === "shift"
      ? !shiftDownloadReady || !selectedHiringManager || downloading
      : !aggregateDownloadReady || !selectedHiringManager || aggDownloading;
  const downloadHint =
    mode === "shift"
      ? shiftDownloadReady
        ? selectedHiringManager
          ? "Download this analysis as a branded PDF report"
          : "Select a hiring manager to bill before downloading"
        : "Select a worker and a concluded shift with a saved analysis"
      : aggregateDownloadReady
        ? selectedHiringManager
          ? "Download the period analysis as a branded PDF report"
          : "Select a hiring manager to bill before downloading"
        : "No analyzed shifts in the selected period yet";
  const busy = downloading || aggDownloading;

  const aggregateChartSeries =
    aggregate?.rows.map((row) => ({
      label: row.name.split(" ")[0],
      value: row.averageScore,
    })) || [];

  return (
    <main className="app-shell standalone-page ai-analysis-page">
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <img alt="" className="panel-title-logo" src="/shiftsync-icon.png" />
            <div>
              <h1>AI Analysis &amp; Summary</h1>
              <p className="panel-subtitle">Gemini-powered performance analysis for concluded shifts</p>
            </div>
          </div>
          <div className="review-actions">
            <Link className="button secondary" href="/"><Home size={17} />Dashboard</Link>
            <button className="button secondary" type="button" disabled={(mode === "shift" && loading) || (mode === "aggregate" && aggLoading) || !token} onClick={() => void refreshAll()}>
              <RefreshCw size={17} />Refresh
            </button>
            <button
              className="button"
              type="button"
              disabled={downloadDisabled}
              onClick={() => void (mode === "shift" ? downloadPdf() : downloadAggregatePdf())}
              title={downloadHint}
            >
              <Download size={17} />{busy ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="mode-toggle" role="tablist" aria-label="Analysis mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "shift"}
            className={mode === "shift" ? "active" : ""}
            onClick={() => switchMode("shift")}
          >
            <Sparkles size={15} />Shift analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "aggregate"}
            className={mode === "aggregate" ? "active" : ""}
            onClick={() => switchMode("aggregate")}
          >
            <CalendarRange size={15} />Aggregate report
          </button>
        </div>

        {mode === "shift" ? (
          <div className="form-grid execution-report-filters">
            <div className="field">
              <label htmlFor="analysis-worker">Team member</label>
              <select
                id="analysis-worker"
                value={workerId}
                onChange={(event) => void selectWorker(event.target.value)}
                disabled={loading || !workers.length}
              >
                {!workers.length && <option value="">No workers with concluded shifts</option>}
                {workers.map((worker) => (
                  <option key={worker._id} value={worker._id}>{worker.name} ({worker.email})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="analysis-shift">Concluded shift</label>
              <select
                id="analysis-shift"
                value={shiftId}
                onChange={(event) => void selectShift(event.target.value)}
                disabled={loading || !shifts.length}
              >
                {!shifts.length && <option value="">No concluded shifts recorded</option>}
                {shifts.map((shift) => (
                  <option key={shift.shiftId} value={shift.shiftId}>
                    {formatDate(shift.workDate)} — {shift.kpiScore}% · {shift.analysis ? shift.analysis.source === "gemini" ? "AI analysis saved" : "summary saved" : "no analysis yet"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="analysis-hiring-manager">Report billed to</label>
              <select
                id="analysis-hiring-manager"
                value={hiringManagerId}
                onChange={(event) => setHiringManagerId(event.target.value)}
                disabled={!hiringManagers.length}
              >
                <option value="">Select hiring manager</option>
                {hiringManagers.map((manager) => (
                  <option key={manager._id} value={manager._id}>{manager.name} ({manager.email})</option>
                ))}
              </select>
            </div>
            <button
              className="button secondary"
              type="button"
              disabled={!shiftId || generating}
              onClick={() => void generateAnalysis()}
            >
              <Sparkles size={17} />{generating ? "Analysing with Gemini…" : analysis ? "Regenerate analysis" : "Generate analysis"}
            </button>
          </div>
        ) : (
          <div className="form-grid execution-report-filters">
            <div className="field">
              <label htmlFor="aggregate-start">From date</label>
              <input
                id="aggregate-start"
                type="date"
                value={aggStart}
                max={aggEnd}
                onChange={(event) => setAggStart(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="aggregate-end">To date</label>
              <input
                id="aggregate-end"
                type="date"
                value={aggEnd}
                min={aggStart}
                onChange={(event) => setAggEnd(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="aggregate-hiring-manager">Report billed to</label>
              <select
                id="aggregate-hiring-manager"
                value={hiringManagerId}
                onChange={(event) => setHiringManagerId(event.target.value)}
                disabled={!hiringManagers.length}
              >
                <option value="">Select hiring manager</option>
                {hiringManagers.map((manager) => (
                  <option key={manager._id} value={manager._id}>{manager.name} ({manager.email})</option>
                ))}
              </select>
            </div>
            <button className="button secondary" type="button" disabled={aggLoading} onClick={() => void applyAggregatePeriod()}>
              <CalendarRange size={17} />Apply period
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={aggGenerating || !aggregate?.rows.length}
              title={aggregate?.rows.length ? "Regenerate the AI narrative for this period" : "No analyzed shifts in this period yet"}
              onClick={() => void generatePeriodSummary()}
            >
              <Sparkles size={17} />{aggGenerating ? "Analysing with Gemini…" : "Generate period summary"}
            </button>
          </div>
        )}
      </section>

      {error && <section className="panel"><p className="muted">{error}</p></section>}

      {overview && (
        <section className="metrics admin-metrics report-metrics">
          <div className="metric"><span>Analyses saved</span><strong>{overview.totalAnalyses}</strong></div>
          <div className="metric"><span>Average score</span><strong>{overview.averageScore}%</strong></div>
          <div className="metric"><span>Gemini-powered</span><strong>{overview.geminiAnalyses}</strong></div>
          <div className="metric"><span>Last 7 days</span><strong>{overview.recentAnalyses}</strong></div>
        </section>
      )}

      {mode === "shift" && (
        <>
          {!loading && !workers.length && (
            <section className="panel">
              <p className="muted">No concluded shifts are available yet. Analyses are generated automatically when a shift ends.</p>
            </section>
          )}

          {!loading && workers.length > 0 && !shifts.length && (
            <section className="panel">
              <p className="muted">No concluded shifts for this worker yet.</p>
            </section>
          )}

          {analysis && (
            <>
              <section className="metrics admin-metrics report-metrics">
                <div className="metric"><span>Overall performance</span><strong>{analysis.overallScore}%</strong></div>
                <div className="metric"><span>Adherence</span><strong>{analysis.adherenceScore}%</strong></div>
                <div className="metric">
                  <span>Worked</span>
                  <strong>
                    {formatMinutes(analysis.metrics.workedMinutes)}
                    {analysis.metrics.scheduledMinutes ? ` / ${formatMinutes(analysis.metrics.scheduledMinutes)}` : ""}
                  </strong>
                </div>
                <div className="metric"><span>Punctuality</span><strong>{analysis.metrics.punctualityScore}%</strong></div>
                <div className="metric"><span>Active engagement</span><strong>{analysis.metrics.monitoring.activeSamplePercent}%</strong></div>
                <div className="metric"><span>Screenshots</span><strong>{analysis.metrics.monitoring.captureCount}</strong></div>
              </section>

              <div className="dashboard-grid ai-analysis-grid">
                <section className="panel ai-score-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <FileText size={20} />
                      <div>
                        <h2>Performance score</h2>
                        <p className="panel-subtitle">Weighted KPI score for this shift</p>
                      </div>
                    </div>
                  </div>
                  <ScoreDonut score={analysis.overallScore} />
                </section>

                <section className="panel ai-narrative-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <Sparkles size={20} />
                      <div>
                        <h2>AI narrative summary</h2>
                        <p className="panel-subtitle">{analysis.narrative.headline || "Shift analysis"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="stack">
                    <div>
                      <h3 className="ai-narrative-heading">Worker performance</h3>
                      <p>{analysis.narrative.workerSummary || "—"}</p>
                    </div>
                    <div>
                      <h3 className="ai-narrative-heading">Work done</h3>
                      <p>{analysis.narrative.workSummary || "—"}</p>
                    </div>
                    {analysis.narrative.highlights.length > 0 && (
                      <ul className="ai-finding-list">
                        {analysis.narrative.highlights.map((highlight) => (
                          <li key={highlight}><CheckCircle2 size={16} />{highlight}</li>
                        ))}
                      </ul>
                    )}
                    {analysis.narrative.concerns.length > 0 && (
                      <ul className="ai-finding-list concerns">
                        {analysis.narrative.concerns.map((concern) => (
                          <li key={concern}><AlertTriangle size={16} />{concern}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </div>

              <div className="dashboard-grid ai-analysis-grid">
                <section className="panel">
                  <BarChart
                    title={analysis.charts.bar.title || "Activity volume"}
                    unit={analysis.charts.bar.unit}
                    series={analysis.charts.bar.series}
                  />
                </section>
                <section className="panel">
                  <PieChart
                    title={analysis.charts.pie.title || "Shift volume mix"}
                    unit={analysis.charts.pie.unit}
                    segments={analysis.charts.pie.segments}
                  />
                </section>
              </div>

              {analysis.metrics.captures.length > 0 && (
                <section className="panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <ScanEye size={20} />
                      <div>
                        <h2>Screenshot evidence</h2>
                        <p className="panel-subtitle">
                          Latest {Math.min(MAX_PDF_CAPTURES, analysis.metrics.captures.length)} of {analysis.metrics.monitoring.captureCount} periodic captures (included in the PDF)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ai-capture-strip">
                    {analysis.metrics.captures.slice(-MAX_PDF_CAPTURES).map((capture) => (
                      <figure key={capture.captureId} className="ai-capture-card">
                        {capturePreviews[capture.captureId]
                          ? <img alt={`Screenshot taken at ${formatDateTime(capture.capturedAt)}`} src={capturePreviews[capture.captureId]} />
                          : <div className="ai-capture-placeholder">Loading…</div>}
                        <figcaption>{formatDateTime(capture.capturedAt)}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {workerId && shiftId && !analysis && !loading && (
            <section className="panel">
              <p className="muted">
                No analysis has been generated for this concluded shift yet. Use “Generate analysis” to create one now — new shifts are analysed automatically when they end.
              </p>
            </section>
          )}
        </>
      )}

      {mode === "aggregate" && (
        <>
          {aggregate && aggregate.rows.length > 0 && (
            <>
              <section className="metrics admin-metrics report-metrics">
                <div className="metric"><span>Workers</span><strong>{aggregate.totals.workers}</strong></div>
                <div className="metric"><span>Shifts analysed</span><strong>{aggregate.totals.analyses}</strong></div>
                <div className="metric"><span>Average score</span><strong>{aggregate.totals.averageScore}%</strong></div>
                <div className="metric"><span>Avg adherence</span><strong>{aggregate.totals.averageAdherence}%</strong></div>
                <div className="metric"><span>Worked time</span><strong>{formatMinutes(aggregate.totals.workedMinutes)}</strong></div>
                <div className="metric"><span>Absent shifts</span><strong>{aggregate.totals.absentCount}</strong></div>
              </section>

              <div className="dashboard-grid ai-analysis-grid">
                <section className="panel ai-score-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <FileText size={20} />
                      <div>
                        <h2>Period performance</h2>
                        <p className="panel-subtitle">Average weighted score across the period</p>
                      </div>
                    </div>
                  </div>
                  <ScoreDonut score={aggregate.totals.averageScore} />
                </section>

                <section className="panel ai-narrative-panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <Sparkles size={20} />
                      <div>
                        <h2>AI period summary</h2>
                        <p className="panel-subtitle">{aggregate.narrative?.narrative.headline || `${formatDate(aggregate.startDate)} — ${formatDate(aggregate.endDate)}`}</p>
                      </div>
                    </div>
                  </div>
                  {aggregate.narrative ? (
                    <div className="stack">
                      <div>
                        <h3 className="ai-narrative-heading">Period overview</h3>
                        <p>{aggregate.narrative.narrative.summary || "—"}</p>
                      </div>
                      {aggregate.narrative.narrative.highlights.length > 0 && (
                        <ul className="ai-finding-list">
                          {aggregate.narrative.narrative.highlights.map((highlight) => (
                            <li key={highlight}><CheckCircle2 size={16} />{highlight}</li>
                          ))}
                        </ul>
                      )}
                      {aggregate.narrative.narrative.concerns.length > 0 && (
                        <ul className="ai-finding-list concerns">
                          {aggregate.narrative.narrative.concerns.map((concern) => (
                            <li key={concern}><AlertTriangle size={16} />{concern}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="muted">
                      No narrative yet for this period. Use “Generate period summary” to have Gemini write one — it is saved and reused until you regenerate it.
                    </p>
                  )}
                </section>
              </div>

              <section className="panel">
                <BarChart
                  title="Average performance score per worker"
                  unit="%"
                  series={aggregateChartSeries}
                />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Users size={20} />
                    <div>
                      <h2>Worker breakdown</h2>
                      <p className="panel-subtitle">Concluded shifts analysed per worker · {formatDate(aggregate.startDate)} — {formatDate(aggregate.endDate)}</p>
                    </div>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Worker</th><th>Shifts</th><th>Absent</th><th>Avg score</th><th>Adherence</th><th>Worked</th></tr>
                    </thead>
                    <tbody>
                      {aggregate.rows.map((row) => (
                        <tr key={row.userId}>
                          <td><strong>{row.name}</strong><span>{row.email}</span></td>
                          <td>{row.shiftCount}</td>
                          <td>{row.absentCount}</td>
                          <td>{row.averageScore}%</td>
                          <td>{row.averageAdherence}%</td>
                          <td>{formatMinutes(row.workedMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {aggregate && !aggregate.rows.length && (
            <section className="panel">
              <p className="muted">
                No analyzed concluded shifts fall within {formatDate(aggregate.startDate)} — {formatDate(aggregate.endDate)}. Widen the period or generate shift analyses first.
              </p>
            </section>
          )}

          {!aggregate && !aggLoading && !error && (
            <section className="panel">
              <p className="muted">Pick a period and press “Apply period” to roll up every analyzed concluded shift per worker.</p>
            </section>
          )}

          {aggLoading && (
            <section className="panel"><p className="muted">Loading aggregate analysis…</p></section>
          )}
        </>
      )}
    </main>
  );
}
