"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  MessageSquare,
  Monitor,
  RefreshCw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { apiRequest, formatDate } from "@/lib/api";
import { formatMinutes } from "@/lib/charts";
import {
  BUSINESS_TIME_ZONE,
  formatRole,
  toDateKey,
} from "@/components/shared";
import { usePwaInstall } from "@/components/pwa/usePwaInstall";
import type { SectionKey } from "@/components/DashboardShell";
import type {
  AdminOverview,
  AggregateAnalysis,
  LeaveRequest,
  PeriodNarrative,
  ScreenMonitorEmployee,
  Schedule,
  User,
} from "@/types/workforce";

type MobileDashboardProps = {
  user: User;
  token: string;
  overview: AdminOverview | null;
  selectedDate: string;
  schedules: Schedule[];
  users: User[];
  leaveRequests: LeaveRequest[];
  screenMonitorEmployees: ScreenMonitorEmployee[];
  loading: boolean;
  onSelectDate: (date: string) => void;
  onNavigate: (section: SectionKey) => void;
  onOpenAgent: (userId: string) => void;
  onRefresh: () => void;
};

type QuickAction = {
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  section?: SectionKey;
  href?: string;
};

type AlertItem = {
  key: string;
  title: string;
  detail: string;
  tone: "warn" | "success";
  actionLabel?: string;
  section?: SectionKey;
  href?: string;
};

type HourCoverage = { hour: number; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12) + days * DAY_MS);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function weekdayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function fullDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function parseClockMinutes(value?: string) {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function londonClockMinutes(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "");
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "");

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function scheduleWindow(schedule: Schedule) {
  const template =
    typeof schedule.shiftTemplateId === "string" ? null : schedule.shiftTemplateId;
  const start =
    londonClockMinutes(schedule.scheduledStartTime) ??
    parseClockMinutes(template?.startTime);
  const end =
    londonClockMinutes(schedule.scheduledEndTime) ??
    parseClockMinutes(template?.endTime);

  if (start === null || end === null) return null;

  // Overnight coverage is expressed past 24:00 so the bar sequence stays linear.
  return { start, end: end <= start ? end + 24 * 60 : end };
}

function buildHourlyCoverage(schedules: Schedule[]): HourCoverage[] {
  const windows = schedules
    .map(scheduleWindow)
    .filter((window): window is { start: number; end: number } => Boolean(window));

  if (!windows.length) return [];

  const earliest = Math.min(...windows.map((window) => window.start));
  const latest = Math.max(...windows.map((window) => window.end));
  const startHour = Math.max(0, Math.floor(earliest / 60) - 1);
  const endHour = Math.min(startHour + 18, Math.max(Math.ceil(latest / 60) + 1, startHour + 4));

  const hours: HourCoverage[] = [];
  for (let offset = startHour; offset < endHour; offset += 1) {
    const windowStart = offset * 60;
    const windowEnd = windowStart + 60;
    const count = windows.reduce((total, window) => {
      const overlap = Math.max(
        0,
        Math.min(window.end, windowEnd) - Math.max(window.start, windowStart)
      );
      return total + overlap / 60;
    }, 0);

    hours.push({ hour: ((offset % 24) + 24) % 24, count });
  }

  return hours;
}

function isSameDay(dateKey: string, other: Date) {
  return dateKey === toDateKey(other);
}

function agentIsOnline(employee: User, presence: ScreenMonitorEmployee[]) {
  return presence.some(
    (entry) =>
      entry.isOnline &&
      (entry.id === employee._id ||
        (Boolean(employee.monitorId) &&
          (entry.activeMonitorId === employee.monitorId || entry.id === employee.monitorId)))
  );
}

const STATUS_LABELS: Record<string, string> = {
  on_time: "On time",
  very_late: "Very late",
  late: "Late",
  absent: "Absent",
  scheduled: "Scheduled",
  unscheduled: "Unscheduled",
  active: "Active",
  completed: "Completed",
  overtime: "Overtime",
};

function formatStatus(status?: string) {
  if (!status) return "No shift";

  return (
    STATUS_LABELS[status] ??
    status
      .replace(/_/g, " ")
      .replace(/\b[a-z]/g, (character) => character.toUpperCase())
  );
}

export default function MobileDashboard({
  user,
  token,
  overview,
  selectedDate,
  schedules,
  users,
  leaveRequests,
  screenMonitorEmployees,
  loading,
  onSelectDate,
  onNavigate,
  onOpenAgent,
  onRefresh,
}: MobileDashboardProps) {
  const isAdmin = user.role === "admin";
  const { mounted: pwaMounted, standalone } = usePwaInstall();
  const [narrative, setNarrative] = useState<PeriodNarrative | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [aiNonce, setAiNonce] = useState(0);
  const [isCompact, setIsCompact] = useState(false);

  const todayKey = toDateKey(new Date());
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDateKey(todayKey, index - 6)),
    [todayKey]
  );

  const rows = useMemo(() => overview?.users ?? [], [overview?.users]);
  const onlineAgents = screenMonitorEmployees.filter((employee) => employee.isOnline);
  const scheduledUsers = rows.filter(
    (row) => row.performance.scheduled || row.performance.status !== "unscheduled"
  );

  const trackedMinutes = rows.reduce(
    (total, row) => total + row.performance.workedMinutes + row.performance.breakMinutes,
    0
  );
  const workedMinutes = rows.reduce((total, row) => total + row.performance.workedMinutes, 0);
  const breakMinutes = rows.reduce((total, row) => total + row.performance.breakMinutes, 0);
  const performanceScore = overview?.totals.averagePerformance ?? 0;
  const coverage = useMemo(() => buildHourlyCoverage(overview?.schedules ?? []), [overview?.schedules]);
  const maxCoverage = Math.max(1, ...coverage.map((entry) => entry.count));

  const scheduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    schedules.forEach((schedule) => {
      const key = toDateKey(schedule.workDate);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [schedules]);

  const pendingLeave = leaveRequests.filter((request) => request.status === "pending").length;
  const pendingManagers = isAdmin
    ? users.filter(
        (member) => member.role === "supervisor" && (member.accountStatus || "approved") === "pending"
      ).length
    : 0;
  // Comparative alert only: the app has no configured productivity target, so
  // this uses the team's own server-calculated average rather than inventing one.
  const belowAverage = scheduledUsers.filter(
    (row) => row.performance.overallScore < performanceScore
  ).length;

  const alerts: AlertItem[] = [];
  if (pendingManagers > 0) {
    alerts.push({
      key: "pending-approvals",
      title: "Hiring manager approvals",
      detail: `${pendingManagers} account${pendingManagers === 1 ? "" : "s"} awaiting admin approval.`,
      tone: "warn",
      actionLabel: "Review accounts",
      section: "accounts",
    });
  }
  if (pendingLeave > 0) {
    alerts.push({
      key: "pending-leave",
      title: "Leave requests waiting",
      detail: `${pendingLeave} request${pendingLeave === 1 ? "" : "s"} ${
        pendingLeave === 1 ? "needs" : "need"
      } a decision.`,
      tone: "warn",
      actionLabel: "Review leave",
      section: "leave",
    });
  }
  if ((overview?.totals.late ?? 0) > 0) {
    alerts.push({
      key: "late",
      title: "Late clock-ins",
      detail: `${overview?.totals.late} of ${overview?.totals.present} present agents arrived late.`,
      tone: "warn",
      actionLabel: "Open reports",
      href: "/execution-report",
    });
  }
  if (belowAverage > 0) {
    alerts.push({
      key: "below-team-average",
      title: "Below team average",
      detail: `${belowAverage} agent${belowAverage === 1 ? "" : "s"} below today's team average of ${performanceScore}%.`,
      tone: "warn",
      actionLabel: "AI analysis",
      href: "/ai-analysis",
    });
  }

  const visibleAlerts = alerts.slice(0, 4);
  const topRows = useMemo(
    () =>
      rows
        .filter((row) => row.performance.scheduled || row.performance.status !== "unscheduled")
        .slice()
        .sort(
          (left, right) =>
            Number(agentIsOnline(right.user, screenMonitorEmployees)) -
              Number(agentIsOnline(left.user, screenMonitorEmployees)) ||
            right.performance.overallScore - left.performance.overallScore
        )
        .slice(0, 6),
    [rows, screenMonitorEmployees]
  );

  const quickActions: QuickAction[] = isAdmin
    ? [
        { label: "Scheduling", icon: CalendarDays, section: "scheduling" },
        { label: "Reports", icon: BarChart3, href: "/execution-report" },
        { label: "AI analysis", icon: Sparkles, href: "/ai-analysis" },
        { label: "Users", icon: Users, section: "accounts" },
      ]
    : [
        { label: "Activity", icon: Monitor, section: "activity-monitoring" },
        { label: "AI analysis", icon: Sparkles, href: "/ai-analysis" },
        { label: "Chat", icon: MessageSquare, section: "chat" },
        { label: "Profile", icon: UserRound, section: "profile" },
      ];

  const loadNarrative = useCallback(
    async (date: string) => {
      setAiState("loading");

      try {
        const data = await apiRequest<AggregateAnalysis>(
          `/api/analysis/aggregate?startDate=${date}&endDate=${date}`,
          { token }
        );
        setNarrative(data.narrative ?? null);
        setAiState(data.narrative ? "ready" : "empty");
      } catch {
        setNarrative(null);
        setAiState("error");
      }
    },
    [token]
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsCompact(media.matches);

    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    // The dashboard remains mounted behind CSS on desktop; avoid a duplicate
    // aggregate request there until the compact layout is actually active.
    if (!isCompact) return;

    void loadNarrative(selectedDate);
  }, [isCompact, loadNarrative, selectedDate, aiNonce]);

  const selectedLabel = isSameDay(selectedDate, new Date())
    ? "Today"
    : new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: BUSINESS_TIME_ZONE,
      }).format(new Date(`${selectedDate}T12:00:00Z`));

  return (
    <div className="mobile-dashboard">
      <div className="m-status-row">
        <span className="m-status-chip">
          <span className="m-live-dot" />
          {pwaMounted && standalone ? "Installed app" : "Live web app"}
        </span>
        <span className="m-status-meta">
          {isAdmin ? "Admin access" : "Hiring manager access"}
        </span>
      </div>

      <button
        className="m-live-card"
        type="button"
        onClick={() => onNavigate("screen-monitor")}
      >
        <span className="m-live-card-icon" aria-hidden="true">
          <Monitor size={22} />
        </span>
        <span className="m-live-card-copy">
          <strong>Watch live screen</strong>
          <span>
            {onlineAgents.length
              ? `${onlineAgents.length} agent${onlineAgents.length === 1 ? "" : "s"} online — tap to watch`
              : "No agents online right now"}
          </span>
        </span>
        <span className={`m-live-pill ${onlineAgents.length ? "is-live" : ""}`}>
          {onlineAgents.length ? (
            <>
              <span className="m-live-dot" />
              LIVE
            </>
          ) : (
            "IDLE"
          )}
        </span>
      </button>

      <div className="m-week-strip" role="group" aria-label="Select overview date">
        {weekDays.map((dateKey) => {
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const count = scheduleCounts.get(dateKey) ?? 0;

          return (
            <button
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${fullDateLabel(dateKey)}${count ? `, ${count} shifts scheduled` : ""}`}
              className={`m-day ${isSelected ? "active" : ""} ${isToday ? "today" : ""}`}
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
            >
              <span className="m-day-name">{isToday ? "Today" : weekdayLabel(dateKey)}</span>
              <span className="m-day-number">{Number(dateKey.slice(8, 10))}</span>
              {isAdmin && (count > 0 || isSelected || isToday) ? (
                <span
                  aria-hidden="true"
                  className={`m-day-dot ${count > 0 ? "has-shifts" : ""}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {!isSameDay(selectedDate, new Date()) && (
        <p className="m-selected-date">
          Viewing {formatDate(`${selectedDate}T12:00:00Z`)}
        </p>
      )}

      {!overview ? (
        <section className="m-card m-loading-card" aria-busy="true" aria-live="polite">
          <RefreshCw className="m-spin" size={18} />
          <span>{loading ? "Loading workforce data…" : "No workforce data available yet."}</span>
          {!loading ? (
            <button className="button secondary compact" type="button" onClick={onRefresh}>
              Retry
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <section className="m-card m-summary-card">
            <header className="m-card-head">
              <div>
                <h2>{selectedLabel}</h2>
                <p>
                  {scheduledUsers.length} scheduled · {overview.totals.users} team member
                  {overview.totals.users === 1 ? "" : "s"}
                </p>
              </div>
              <span className="m-score-pill">{performanceScore}% performance</span>
            </header>

            <div className="m-kpi-grid">
              <div className="m-kpi">
                <strong>{formatMinutes(trackedMinutes)}</strong>
                <span>Tracked</span>
              </div>
              <div className="m-kpi is-primary">
                <strong>{formatMinutes(workedMinutes)}</strong>
                <span>Worked</span>
              </div>
              <div className="m-kpi">
                <strong>{formatMinutes(breakMinutes)}</strong>
                <span>Break</span>
              </div>
            </div>

            <div
              className="m-progress"
              role="progressbar"
              aria-label="Average performance"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={performanceScore}
            >
              <span style={{ width: `${Math.max(0, Math.min(100, performanceScore))}%` }} />
            </div>

            <div className="m-mini-stats">
              <span>
                <Users size={14} />
                <b>{overview.totals.present}</b> present
              </span>
              <span>
                <Clock3 size={14} />
                <b>{overview.totals.late}</b> late
              </span>
              <span>
                <ClipboardList size={14} />
                <b>{overview.totals.absent}</b> absent
              </span>
            </div>

            {coverage.length ? (
              <div className="m-hourly">
                <div className="m-hourly-head">
                  <span>Scheduled coverage</span>
                  <span className="muted">Agents per hour</span>
                </div>
                <div
                  className="m-hourly-bars"
                  role="img"
                  aria-label={`Scheduled agent coverage from ${coverage[0].hour}:00 to ${
                    coverage[coverage.length - 1].hour
                  }:00`}
                >
                  {coverage.map((entry) => (
                    <span
                      className={`m-hour-bar ${entry.count > 0 ? "is-filled" : ""}`}
                      key={entry.hour}
                      title={`${String(entry.hour).padStart(2, "0")}:00 — ${entry.count.toFixed(
                        1
                      )} agent${entry.count === 1 ? "" : "s"}`}
                    >
                      <i
                        style={{
                          height: `${Math.max(6, (entry.count / maxCoverage) * 100)}%`,
                        }}
                      />
                    </span>
                  ))}
                </div>
                <div className="m-hourly-axis" aria-hidden="true">
                  <span>{String(coverage[0].hour).padStart(2, "0")}:00</span>
                  <span>
                    {String(coverage[coverage.length - 1].hour).padStart(2, "0")}:00
                  </span>
                </div>
              </div>
            ) : (
              <p className="m-card-empty">
                No scheduled shifts recorded for this date, so hourly coverage is unavailable.
              </p>
            )}
          </section>

          <section className="m-card m-ai-card">
            <header className="m-card-head">
              <div className="m-ai-title">
                <span className="m-ai-icon" aria-hidden="true">
                  <Sparkles size={17} />
                </span>
                <div>
                  <h2>AI summary</h2>
                  <p>{formatDate(`${selectedDate}T12:00:00Z`)}</p>
                </div>
              </div>
              <button
                aria-label="Refresh AI summary"
                className="m-icon-button"
                disabled={aiState === "loading"}
                type="button"
                onClick={() => setAiNonce((current) => current + 1)}
              >
                <RefreshCw className={aiState === "loading" ? "m-spin" : ""} size={16} />
              </button>
            </header>

            {aiState === "loading" && !narrative ? (
              <p className="m-card-empty">Loading the saved summary…</p>
            ) : null}

            {aiState === "error" ? (
              <p className="m-card-empty">
                The AI summary could not be loaded. Check your connection and try again.
              </p>
            ) : null}

            {aiState === "empty" || (aiState === "ready" && !narrative) ? (
              <p className="m-card-empty">
                No summary has been saved for this date yet. Open AI Analysis to generate one
                from the recorded shifts.
              </p>
            ) : null}

            {narrative ? (
              <>
                <h3 className="m-ai-headline">{narrative.narrative.headline}</h3>
                <p className="m-ai-copy">{narrative.narrative.summary}</p>
                {narrative.narrative.highlights?.length ? (
                  <ul className="m-ai-list">
                    {narrative.narrative.highlights.slice(0, 2).map((item) => (
                      <li key={item}>
                        <CheckCircle2 size={13} />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="m-ai-foot">
                  <span className="m-source-pill">
                    {narrative.source === "gemini" ? "Gemini" : "Deterministic summary"}
                  </span>
                  <Link className="m-text-link" href="/ai-analysis">
                    Open AI analysis
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </>
            ) : (
              <Link className="m-text-link" href="/ai-analysis">
                Open AI analysis
                <ArrowRight size={14} />
              </Link>
            )}
          </section>

          <section className="m-card m-alerts-card">
            <header className="m-card-head">
              <div>
                <h2>Alerts</h2>
                <p>Attendance, approvals and team performance</p>
              </div>
            </header>

            {visibleAlerts.length ? (
              <ul className="m-alert-list">
                {visibleAlerts.map((alert) => (
                  <li className={`m-alert ${alert.tone}`} key={alert.key}>
                    <span className="m-alert-icon" aria-hidden="true">
                      <AlertTriangle size={16} />
                    </span>
                    <span className="m-alert-copy">
                      <strong>{alert.title}</strong>
                      <span>{alert.detail}</span>
                      {alert.actionLabel ? (
                        alert.href ? (
                          <Link className="m-alert-link" href={alert.href}>
                            {alert.actionLabel}
                          </Link>
                        ) : alert.section ? (
                          <button
                            className="m-alert-link"
                            type="button"
                            onClick={() => onNavigate(alert.section as SectionKey)}
                          >
                            {alert.actionLabel}
                          </button>
                        ) : null
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="m-empty-alert">
                <CheckCircle2 size={17} />
                <span>No attendance, break or approval alerts for this date.</span>
              </div>
            )}
          </section>

          <section className="m-card m-team-card">
            <header className="m-card-head">
              <div>
                <h2>Team today</h2>
                <p>
                  {onlineAgents.length} online · {topRows.length} shown
                </p>
              </div>
              {isAdmin ? (
                <button
                  className="m-text-link"
                  type="button"
                  onClick={() => onNavigate("accounts")}
                >
                  Manage
                  <ChevronRight size={14} />
                </button>
              ) : null}
            </header>

            {topRows.length ? (
              <ul className="m-team-list">
                {topRows.map((row) => {
                  const online = agentIsOnline(row.user, screenMonitorEmployees);
                  const score = Math.max(0, Math.min(100, row.performance.overallScore));

                  return (
                    <li key={row.user._id}>
                      <button
                        aria-label={`Open monitoring data for ${row.user.name}`}
                        className="m-team-row"
                        type="button"
                        onClick={() => onOpenAgent(row.user._id)}
                      >
                        <span className="m-team-avatar">
                          {row.user.name.slice(0, 1).toUpperCase()}
                          <i className={online ? "online" : "offline"} aria-hidden="true" />
                        </span>
                        <span className="m-team-copy">
                          <span className="m-team-name">
                            <strong>{row.user.name}</strong>
                            <small>{formatRole(row.user.role)}</small>
                          </span>
                          <span className="m-team-bar">
                            <i style={{ width: `${score}%` }} />
                          </span>
                        </span>
                        <span className="m-team-score">
                          <strong>{score}%</strong>
                          <small>{online ? "Online" : formatStatus(row.performance.status)}</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-card-empty">No team members are available in your scope.</p>
            )}
          </section>

          <section className="m-quick-actions" aria-label="Quick actions">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return action.href ? (
                <Link className="m-quick-action" href={action.href} key={action.label}>
                  <span>
                    <Icon size={18} />
                  </span>
                  {action.label}
                </Link>
              ) : (
                <button
                  className="m-quick-action"
                  key={action.label}
                  type="button"
                  onClick={() => action.section && onNavigate(action.section)}
                >
                  <span>
                    <Icon size={18} />
                  </span>
                  {action.label}
                </button>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
