"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Home, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest, formatDate } from "@/lib/api";
import type { ExecutionReport, User } from "@/types/workforce";

const BUSINESS_TIME_ZONE = "Europe/London";

function dateKey(value = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function escapeExcelCell(value: string | number | undefined | null) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ExecutionReportPage() {
  const today = dateKey();
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function setReportDates(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem("workforce_token");
    if (!savedToken) {
      setError("Sign in as an admin to view execution reports.");
      setLoading(false);
      return;
    }
    setToken(savedToken);
    void loadReport(savedToken, today, today);
  }, []);

  async function loadReport(authToken = token, start = startDate, end = endDate) {
    if (!authToken) return;
    if (end < start) {
      setError("The end date must be on or after the start date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const currentUser = await apiRequest<User>("/api/auth/me", { token: authToken });
      if (currentUser.role !== "admin") throw new Error("Only admins can view execution reports.");
      const data = await apiRequest<ExecutionReport>(`/api/execution/admin/report?startDate=${start}&endDate=${end}`, { token: authToken });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load execution report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  const users = useMemo(() => {
    const byId = new Map<string, User>();
    report?.rows.forEach((row) => byId.set(row.user._id, row.user));
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [report]);
  const rows = useMemo(() => report?.rows.filter((row) => !userId || row.user._id === userId) || [], [report, userId]);

  function downloadExcel() {
    if (!report) return;
    const content = rows.map((row) => `<tr><td>${escapeExcelCell(formatDate(row.date))}</td><td>${escapeExcelCell(row.user.name)}</td><td>${escapeExcelCell(row.user.email)}</td><td>${escapeExcelCell(row.performance.status)}</td><td>${row.performance.overallScore}%</td><td>${row.performance.adherenceScore ?? row.performance.breakdown.activityAdherenceScore ?? 0}%</td><td>${row.performance.workedMinutes}m</td><td>${row.performance.scheduledMinutes}m</td><td>${row.performance.breakMinutes}m</td><td>${row.performance.lateMinutes}m</td><td>${row.performance.overtimeMinutes}m</td></tr>`).join("");
    const blob = new Blob([`<table><thead><tr><th>Date</th><th>User</th><th>Email</th><th>Status</th><th>Overall</th><th>Adherence</th><th>Worked</th><th>Scheduled</th><th>Breaks</th><th>Late</th><th>Overtime</th></tr></thead><tbody>${content}</tbody></table>`], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `execution-report-${startDate}-to-${endDate}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <main className="app-shell execution-report-page">
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title"><ShieldCheck size={20} /><div><h1>Execution Reports</h1><p className="panel-subtitle">Flexible historical adherence and workforce execution reporting</p></div></div>
        <div className="review-actions"><Link className="button secondary" href="/"><Home size={17} />Dashboard</Link><button className="button secondary" type="button" disabled={loading || !token} onClick={() => loadReport()}><RefreshCw size={17} />Refresh</button><button className="button secondary" type="button" disabled={loading || !token} onClick={() => { setReportDates(today, today); void loadReport(token, today, today); }}>Today</button><button className="button" type="button" disabled={!rows.length} onClick={downloadExcel}><Download size={17} />Download Excel</button></div>
      </div>
      <div className="form-grid execution-report-filters">
        <div className="field"><label htmlFor="execution-start">From date</label><input id="execution-start" type="date" value={startDate} onChange={(event) => { const next = event.target.value; setReportDates(next, next > endDate ? next : endDate); }} /></div>
        <div className="field"><label htmlFor="execution-end">To date</label><input id="execution-end" type="date" value={endDate} onChange={(event) => { const next = event.target.value; setReportDates(next < startDate ? next : startDate, next); }} /></div>
        <div className="field"><label htmlFor="execution-user">Team member</label><select id="execution-user" value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">All team members</option>{users.map((user) => <option key={user._id} value={user._id}>{user.name} ({user.email})</option>)}</select></div>
        <button className="button" type="button" disabled={loading} onClick={() => loadReport()}>Apply period</button>
      </div>
    </section>
    {error && <section className="panel"><p className="muted">{error}</p></section>}
    {report && <>
      <section className="metrics admin-metrics report-metrics"><div className="metric"><span>Records</span><strong>{rows.length}</strong></div><div className="metric"><span>Period</span><strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong></div><div className="metric"><span>Avg adherence</span><strong>{report.totals.averageAdherence}%</strong></div><div className="metric"><span>Avg performance</span><strong>{report.totals.averagePerformance}%</strong></div><div className="metric"><span>Work done</span><strong>{report.totals.workedMinutes}m</strong></div><div className="metric"><span>Scheduled</span><strong>{report.totals.scheduledMinutes}m</strong></div></section>
      <section className="panel"><div className="panel-header"><div className="panel-title"><ShieldCheck size={20} /><div><h2>Execution records</h2><p className="panel-subtitle">One row per team member and scheduled activity date</p></div></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>User</th><th>Status</th><th>Overall</th><th>Adherence</th><th>Worked</th><th>Scheduled</th><th>Breaks</th><th>Late</th><th>Overtime</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.date}-${row.user._id}`}><td>{formatDate(row.date)}</td><td><strong>{row.user.name}</strong><span>{row.user.email}</span></td><td>{row.performance.status}</td><td>{row.performance.overallScore}%</td><td>{row.performance.adherenceScore ?? row.performance.breakdown.activityAdherenceScore ?? 0}%</td><td>{row.performance.workedMinutes}m</td><td>{row.performance.scheduledMinutes}m</td><td>{row.performance.breakMinutes}m</td><td>{row.performance.lateMinutes}m</td><td>{row.performance.overtimeMinutes}m</td></tr>)}</tbody></table>{!loading && !rows.length && <p className="muted">No execution records match this period.</p>}</div></section>
    </>}
  </main>;
}
