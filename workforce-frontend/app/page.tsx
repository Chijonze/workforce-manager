"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Coffee,
  DoorOpen,
  Eye,
  EyeOff,
  History,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  UserRound,
} from "lucide-react";
import { apiRequest, formatDate, formatDateTime } from "@/lib/api";
import type {
  ActiveShiftResponse,
  AdminOverview,
  DailyPerformance,
  Schedule,
  ShiftEvent,
  ShiftTemplate,
  User,
} from "@/types/workforce";

type AuthMode = "login" | "register";
type BreakForm = { label: string; durationMinutes: number };
type Toast = { id: number; type: "success" | "error"; message: string };

type AuthResponse = {
  token: string;
  user: User;
};

const eventLabels: Record<ShiftEvent["type"], string> = {
  SHIFT_START: "Shift started",
  WORK_START: "Work started",
  BREAK_START: "Break started",
  BREAK_END: "Break ended",
  SHIFT_END: "Shift ended",
};

const defaultBreaks: BreakForm[] = [
  { label: "Break 1", durationMinutes: 15 },
];

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [templateForm, setTemplateForm] = useState({
    name: "Day Operations",
    startTime: "08:00",
    endTime: "17:00",
    breakCount: 1,
    breaks: defaultBreaks,
  });
  const [scheduleForm, setScheduleForm] = useState({
    userId: "",
    shiftTemplateId: "",
    workDate: new Date().toISOString().slice(0, 10),
  });
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeShift, setActiveShift] = useState<ActiveShiftResponse>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === "admin";
  const currentShiftId = activeShift?.shift._id;
  const currentState = activeShift?.currentState || "Not clocked in";

  const attendanceTone = useMemo(() => {
    const status = activeShift?.shift.attendanceStatus;
    if (!status) return "";
    if (status === "late" || status === "very_late") return "warn";
    if (status === "absent") return "danger";
    return "";
  }, [activeShift]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("workforce_token");
    if (!savedToken) return;

    setToken(savedToken);
    hydrateSession(savedToken);
  }, []);

  useEffect(() => {
    if (!user || isAdmin || scheduleForm.userId) return;
    setScheduleForm((current) => ({ ...current, userId: user._id }));
  }, [isAdmin, scheduleForm.userId, user]);

  function notify(type: Toast["type"], message: string) {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  async function runAction<T>(action: () => Promise<T>, success?: string) {
    setLoading(true);

    try {
      const result = await action();
      if (success) notify("success", success);
      return result;
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function hydrateSession(authToken: string) {
    await runAction(async () => {
      const currentUser = await apiRequest<User>("/api/auth/me", { token: authToken });
      setUser(currentUser);
      await refreshWorkspace(authToken, currentUser);
      return currentUser;
    });
  }

  async function refreshWorkspace(authToken = token, currentUser = user) {
    if (!authToken || !currentUser) return;

    const [active, performance] = await Promise.all([
      apiRequest<ActiveShiftResponse>("/api/attendance/shift/active", {
        token: authToken,
      }),
      apiRequest<DailyPerformance>("/api/execution/me/daily", {
        token: authToken,
      }),
    ]);

    setActiveShift(active);
    setDailyPerformance(performance);

    if (active?.shift._id) {
      const shiftEvents = await apiRequest<ShiftEvent[]>(
        `/api/attendance/shift/${active.shift._id}/events`,
        { token: authToken }
      );
      setEvents(shiftEvents);
    } else {
      setEvents([]);
    }

    if (currentUser.role === "admin") {
      const [templateList, scheduleList, userList, overview] = await Promise.all([
        apiRequest<ShiftTemplate[]>("/api/scheduling/templates", { token: authToken }),
        apiRequest<Schedule[]>("/api/scheduling/schedule", { token: authToken }),
        apiRequest<User[]>("/api/auth/users", { token: authToken }),
        apiRequest<AdminOverview>("/api/execution/admin/overview", { token: authToken }),
      ]);

      setTemplates(templateList);
      setSchedules(scheduleList);
      setUsers(userList);
      setAdminOverview(overview);

      setScheduleForm((current) => ({
        ...current,
        userId: current.userId || userList[0]?._id || "",
        shiftTemplateId: current.shiftTemplateId || templateList[0]?._id || "",
      }));
      return;
    }

    const mySchedules = await apiRequest<Schedule[]>("/api/scheduling/schedule/me", {
      token: authToken,
    });
    setSchedules(mySchedules);
    setTemplates([]);
    setUsers([]);
    setAdminOverview(null);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authForm.email, password: authForm.password }
        : {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
          };

    const result = await runAction(
      () =>
        apiRequest<AuthResponse>(endpoint, {
          method: "POST",
          body: payload,
        }),
      authMode === "login" ? "Signed in" : "Account created"
    );

    if (!result) return;

    window.localStorage.setItem("workforce_token", result.token);
    setToken(result.token);
    setUser(result.user);
    await refreshWorkspace(result.token, result.user);
  }

  function setBreakCount(count: number) {
    const nextCount = Math.min(3, Math.max(1, count));
    setTemplateForm((current) => {
      const nextBreaks = [...current.breaks];
      while (nextBreaks.length < nextCount) {
        nextBreaks.push({
          label: `Break ${nextBreaks.length + 1}`,
          durationMinutes: 15,
        });
      }

      return {
        ...current,
        breakCount: nextCount,
        breaks: nextBreaks.slice(0, nextCount),
      };
    });
  }

  function updateBreak(index: number, key: keyof BreakForm, value: string | number) {
    setTemplateForm((current) => ({
      ...current,
      breaks: current.breaks.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isAdmin) return;

    await runAction(async () => {
      await apiRequest<ShiftTemplate>("/api/scheduling/templates", {
        method: "POST",
        token,
        body: {
          name: templateForm.name,
          startTime: templateForm.startTime,
          endTime: templateForm.endTime,
          breaks: templateForm.breaks.map((item, index) => ({
            label: item.label || `Break ${index + 1}`,
            durationMinutes: Math.min(45, Math.max(15, Number(item.durationMinutes))),
          })),
        },
      });
      await refreshWorkspace();
    }, "Template created");
  }

  async function assignSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isAdmin) return;

    await runAction(async () => {
      await apiRequest<Schedule>("/api/scheduling/schedule", {
        method: "POST",
        token,
        body: scheduleForm,
      });
      await refreshWorkspace();
    }, "Schedule assigned");
  }

  async function shiftAction(path: string, success: string) {
    if (!token) return;

    await runAction(async () => {
      await apiRequest(path, {
        method: "POST",
        token,
        body: currentShiftId ? { shiftId: currentShiftId } : undefined,
      });
      await refreshWorkspace();
    }, success);
  }

  async function runMaintenance() {
    if (!token || !isAdmin) return;

    await runAction(async () => {
      const result = await apiRequest<{ autoClosed: number; missedShifts: number }>(
        "/api/execution/admin/maintenance",
        {
          method: "POST",
          token,
        }
      );
      await refreshWorkspace();
      return result;
    }, "Execution maintenance completed");
  }

  function logout() {
    window.localStorage.removeItem("workforce_token");
    setToken(null);
    setUser(null);
    setUsers([]);
    setActiveShift(null);
    setEvents([]);
    setToasts([]);
  }

  if (!token || !user) {
    return (
      <main className="auth-wrap">
        <ToastStack toasts={toasts} />
        <section className="auth-panel">
          <div className="brand">
            <div className="brand-mark">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1>Workforce Manager</h1>
              <p>Execution dashboard for scheduled teams</p>
            </div>
          </div>

          <div className="auth-switch" aria-label="Authentication mode">
            <button
              className={authMode === "login" ? "active" : ""}
              type="button"
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              className={authMode === "register" ? "active" : ""}
              type="button"
              onClick={() => setAuthMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth}>
            {authMode === "register" && (
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={authForm.name}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button className="button full" disabled={loading} type="submit">
              <LogIn size={17} />
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ToastStack toasts={toasts} />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={22} />
          </div>
          <div>
            <h1>Workforce Manager</h1>
            <p>Attendance, schedules, and live shift execution</p>
          </div>
        </div>

        <div className="user-strip">
          <span>
            {user.name} <span className="pill">{user.role}</span>
          </span>
          <button className="icon-button" type="button" onClick={() => refreshWorkspace()}>
            <RefreshCw size={17} />
          </button>
          <button className="button secondary" type="button" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </header>

      <div className="page stack">
        {dailyPerformance && <PerformancePanel performance={dailyPerformance} />}

        {isAdmin && adminOverview && (
          <AdminOverviewPanel
            loading={loading}
            overview={adminOverview}
            onRunMaintenance={runMaintenance}
          />
        )}

        <section className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <Clock3 size={20} />
              <div>
                <h2>Live Shift</h2>
                <p className="panel-subtitle">Current operational state for the signed-in user</p>
              </div>
            </div>
            <span className={`pill ${attendanceTone}`}>{currentState}</span>
          </div>

          <div className="metrics">
            <div className="metric">
              <span>Scheduled start</span>
              <strong>{formatDateTime(activeShift?.shift.scheduledStartTime)}</strong>
            </div>
            <div className="metric">
              <span>Clock in</span>
              <strong>{formatDateTime(activeShift?.shift.clockInTime)}</strong>
            </div>
            <div className="metric">
              <span>Late minutes</span>
              <strong>{activeShift?.shift.lateMinutes ?? 0}</strong>
            </div>
            <div className="metric">
              <span>Status</span>
              <strong>{activeShift?.shift.attendanceStatus || "Ready"}</strong>
            </div>
          </div>

          <div className="controls" style={{ marginTop: 16 }}>
            <button
              className="button"
              disabled={loading || Boolean(activeShift)}
              type="button"
              onClick={() => shiftAction("/api/attendance/shift/start", "Shift started")}
            >
              <Play size={17} />
              Start shift
            </button>
            <button
              className="button secondary"
              disabled={loading || !activeShift}
              type="button"
              onClick={() => shiftAction("/api/attendance/work/start", "Work state started")}
            >
              <Square size={17} />
              Start work
            </button>
            <button
              className="button warning"
              disabled={loading || !activeShift}
              type="button"
              onClick={() => shiftAction("/api/attendance/break/start", "Break started")}
            >
              <Coffee size={17} />
              Start break
            </button>
            <button
              className="button secondary"
              disabled={loading || !activeShift}
              type="button"
              onClick={() => shiftAction("/api/attendance/break/end", "Break ended")}
            >
              <BadgeCheck size={17} />
              End break
            </button>
          </div>

          <button
            className="button danger"
            disabled={loading || !activeShift}
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => shiftAction("/api/attendance/shift/end", "Shift ended")}
          >
            <DoorOpen size={17} />
            End shift
          </button>
        </section>

        {isAdmin && (
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <CalendarDays size={20} />
                  <div>
                    <h2>Scheduling Setup</h2>
                    <p className="panel-subtitle">Create a template and assign it to a work date</p>
                  </div>
                </div>
              </div>

              <div className="stack">
                <form className="form-grid" onSubmit={createTemplate}>
                  <div className="field">
                    <label htmlFor="template-name">Template name</label>
                    <input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="break-count">Breaks</label>
                    <select
                      id="break-count"
                      value={templateForm.breakCount}
                      onChange={(event) => setBreakCount(Number(event.target.value))}
                    >
                      <option value={1}>1 break</option>
                      <option value={2}>2 breaks</option>
                      <option value={3}>3 breaks</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="start-time">Start time</label>
                    <input
                      id="start-time"
                      type="time"
                      value={templateForm.startTime}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="end-time">End time</label>
                    <input
                      id="end-time"
                      type="time"
                      value={templateForm.endTime}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="break-editor">
                    {templateForm.breaks.map((breakItem, index) => (
                      <div className="break-row" key={index}>
                        <div className="field">
                          <label htmlFor={`break-label-${index}`}>Break {index + 1}</label>
                          <input
                            id={`break-label-${index}`}
                            value={breakItem.label}
                            onChange={(event) => updateBreak(index, "label", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`break-duration-${index}`}>Minutes</label>
                          <input
                            id={`break-duration-${index}`}
                            max={45}
                            min={15}
                            step={5}
                            type="number"
                            value={breakItem.durationMinutes}
                            onChange={(event) =>
                              updateBreak(index, "durationMinutes", Number(event.target.value))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="button" disabled={loading} type="submit">
                    <Plus size={17} />
                    Create template
                  </button>
                </form>

                <form className="form-grid" onSubmit={assignSchedule}>
                  <div className="field">
                    <label htmlFor="assignee">Team member</label>
                    <select
                      id="assignee"
                      value={scheduleForm.userId}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          userId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select user</option>
                      {users.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name} ({member.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="template">Template</label>
                    <select
                      id="template"
                      value={scheduleForm.shiftTemplateId}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          shiftTemplateId: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select template</option>
                      {templates.map((template) => (
                        <option key={template._id} value={template._id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="work-date">Work date</label>
                    <input
                      id="work-date"
                      type="date"
                      value={scheduleForm.workDate}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          workDate: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <button className="button secondary" disabled={loading} type="submit">
                    <CalendarDays size={17} />
                    Assign schedule
                  </button>
                </form>
              </div>
            </section>

            <ShiftEventsPanel events={events} />
          </div>
        )}

        {!isAdmin && (
          <div className="dashboard-grid">
            <AssignedSchedules schedules={schedules} users={[user]} />
            <ShiftEventsPanel events={events} />
          </div>
        )}

        {isAdmin && (
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <UserRound size={20} />
                  <div>
                    <h2>Templates</h2>
                    <p className="panel-subtitle">Reusable shift structures</p>
                  </div>
                </div>
              </div>

              <div className="record-list">
                {templates.length ? (
                  templates.map((template) => (
                    <article className="record" key={template._id}>
                      <div className="record-row">
                        <span className="record-title">{template.name}</span>
                        <span className="pill">
                          {template.startTime} to {template.endTime}
                        </span>
                      </div>
                      <span className="muted">
                        {template.breaks
                          ?.map((item) => `${item.label}: ${item.durationMinutes}m`)
                          .join(" | ") || "No breaks"}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="muted">No templates created yet.</p>
                )}
              </div>
            </section>

            <AssignedSchedules schedules={schedules} users={users} />
          </div>
        )}
      </div>
    </main>
  );
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function PerformancePanel({ performance }: { performance: DailyPerformance }) {
  const score = Math.max(0, Math.min(100, performance.overallScore));

  return (
    <section className="panel performance-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={20} />
          <div>
            <h2>Daily Performance</h2>
            <p className="panel-subtitle">
              {formatDate(performance.date)} · {performance.status}
            </p>
          </div>
        </div>
        <span className={`pill ${score < 60 ? "danger" : score < 80 ? "warn" : ""}`}>
          {score}% overall
        </span>
      </div>

      <div className="performance-grid">
        <div
          aria-label={`Daily performance score ${score}%`}
          className="score-pie"
          style={{ "--score": `${score}%` } as CSSProperties}
        >
          <div>
            <strong>{score}%</strong>
            <span>overall</span>
          </div>
        </div>

        <div className="metrics compact">
          <div className="metric">
            <span>Worked</span>
            <strong>{performance.workedMinutes}m</strong>
          </div>
          <div className="metric">
            <span>Scheduled</span>
            <strong>{performance.scheduledMinutes}m</strong>
          </div>
          <div className="metric">
            <span>Break</span>
            <strong>{performance.breakMinutes}m</strong>
          </div>
          <div className="metric">
            <span>Late</span>
            <strong>{performance.lateMinutes}m</strong>
          </div>
        </div>
      </div>

      <div className="score-bars">
        <ScoreBar label="Work completion" value={performance.breakdown.workScore} />
        <ScoreBar label="Punctuality" value={performance.breakdown.punctualityScore} />
        <ScoreBar label="Break compliance" value={performance.breakdown.breakScore} />
      </div>
    </section>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const score = Math.max(0, Math.min(100, value));

  return (
    <div className="score-bar">
      <div className="record-row">
        <span>{label}</span>
        <strong>{score}%</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function AdminOverviewPanel({
  loading,
  overview,
  onRunMaintenance,
}: {
  loading: boolean;
  overview: AdminOverview;
  onRunMaintenance: () => void;
}) {
  return (
    <section className="panel admin-overview">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldCheck size={20} />
          <div>
            <h2>Admin Execution Overview</h2>
            <p className="panel-subtitle">
              Workforce analytics for {formatDate(overview.date)}
            </p>
          </div>
        </div>
        <button className="button secondary" disabled={loading} type="button" onClick={onRunMaintenance}>
          <RefreshCw size={17} />
          Run maintenance
        </button>
      </div>

      <div className="metrics admin-metrics">
        <div className="metric">
          <span>Attendance rate</span>
          <strong>{overview.totals.attendanceRate}%</strong>
        </div>
        <div className="metric">
          <span>Avg performance</span>
          <strong>{overview.totals.averagePerformance}%</strong>
        </div>
        <div className="metric">
          <span>Active shifts</span>
          <strong>{overview.totals.active}</strong>
        </div>
        <div className="metric">
          <span>Scheduled</span>
          <strong>{overview.totals.scheduled}</strong>
        </div>
        <div className="metric">
          <span>Present</span>
          <strong>{overview.totals.present}</strong>
        </div>
        <div className="metric">
          <span>Absent</span>
          <strong>{overview.totals.absent}</strong>
        </div>
        <div className="metric">
          <span>Late</span>
          <strong>{overview.totals.late}</strong>
        </div>
        <div className="metric">
          <span>Overtime</span>
          <strong>{overview.totals.overtime}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Overall</th>
              <th>Worked</th>
              <th>Late</th>
              <th>Overtime</th>
            </tr>
          </thead>
          <tbody>
            {overview.users.map((item) => (
              <tr key={item.user._id}>
                <td>
                  <strong>{item.user.name}</strong>
                  <span>{item.user.email}</span>
                </td>
                <td>{item.performance.status}</td>
                <td>{item.performance.overallScore}%</td>
                <td>{item.performance.workedMinutes}m</td>
                <td>{item.performance.lateMinutes}m</td>
                <td>{item.performance.overtimeMinutes}m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ShiftEventsPanel({ events }: { events: ShiftEvent[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <History size={20} />
          <div>
            <h2>Shift Events</h2>
            <p className="panel-subtitle">State machine history for the active shift</p>
          </div>
        </div>
      </div>

      <div className="timeline">
        {events.length ? (
          events.map((event) => (
            <div className="event" key={event._id}>
              <div className="event-dot">
                <Activity size={15} />
              </div>
              <div>
                <strong>{eventLabels[event.type]}</strong>
                <span>{formatDateTime(event.timestamp)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No active shift events yet.</p>
        )}
      </div>
    </section>
  );
}

function AssignedSchedules({
  schedules,
  users,
}: {
  schedules: Schedule[];
  users: User[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={20} />
          <div>
            <h2>Schedules</h2>
            <p className="panel-subtitle">Assigned work dates</p>
          </div>
        </div>
      </div>

      <div className="record-list">
        {schedules.length ? (
          schedules.map((schedule) => {
            const template =
              typeof schedule.shiftTemplateId === "string" ? null : schedule.shiftTemplateId;
            const member = users.find((item) => item._id === schedule.userId);

            return (
              <article className="record" key={schedule._id}>
                <div className="record-row">
                  <span className="record-title">{template?.name || "Assigned shift"}</span>
                  <span className="pill">{formatDate(schedule.workDate)}</span>
                </div>
                <span className="muted">
                  {member ? `User: ${member.name}` : `User ID: ${schedule.userId}`}
                </span>
              </article>
            );
          })
        ) : (
          <p className="muted">No schedules assigned yet.</p>
        )}
      </div>
    </section>
  );
}
