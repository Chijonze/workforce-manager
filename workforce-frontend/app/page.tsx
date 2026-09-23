"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";
import { apiRequest, getScreenMonitorWsUrl } from "@/lib/api";
import {
  createMonitoringSession,
  type MonitoringHandle,
  type MonitoringStats,
} from "@/lib/monitoring";
import { DashboardShell, navGroupsForRole, type SectionKey } from "@/components/DashboardShell";
import {
  DesktopOnlyNotice,
  ToastStack,
  formatRole,
  getScheduleTemplate,
  toDateKey,
  type Toast,
} from "@/components/shared";
import ScreenMonitorPanel from "@/components/panels/ScreenMonitorPanel";
import SchedulingSetupPanel from "@/components/panels/SchedulingSetupPanel";
import MonitoringPanel from "@/components/panels/MonitoringPanel";
import LeavePanel from "@/components/panels/LeavePanel";
import ChatPanel from "@/components/panels/ChatPanel";
import { ScheduleSummary, AssignedSchedules } from "@/components/panels/SchedulePanels";
import {
  AdminOverviewPanel,
  HiringManagerAgentAllocationPanel,
  UserAccountsPanel,
} from "@/components/panels/AdminPanels";
import {
  LiveExecutionPanel,
  MonthlyActivityCalendar,
  PerformancePanel,
  ShiftEventsPanel,
  activityOptions,
  allowedTransitions,
  getActivityFromEvent,
  getActivityStart,
  type ActivityState,
} from "@/components/panels/WorkerPanels";
import type {
  ActiveShiftResponse,
  AdminOverview,
  ChatConversation,
  ChatMessage,
  DailyPerformance,
  LeaveRequest,
  Schedule,
  ScreenMonitorEmployee,
  ScreenMonitorPresence,
  ShiftEvent,
  ShiftTemplate,
  Role,
  User,
} from "@/types/workforce";

type AuthMode = "login" | "register";
const STRONG_PASSWORD_PATTERN = "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,}";
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
const STRONG_PASSWORD_HINT = "Use at least 12 characters, including uppercase, lowercase, a number, and a symbol.";

type MfaSetup = { manualKey: string; otpauthUrl: string };

type AuthResponse = {
  token?: string;
  user: User;
  mfaRequired?: boolean;
  mfaToken?: string;
  mfaSetupRequired?: boolean;
};

const activityTone: Partial<Record<ActivityState, string>> = {
  BREAK: "warn",
  LUNCH: "warn",
  END_SHIFT: "danger",
  OFFLINE: "danger",
};

// Last-resort caps used only when an assigned template is unavailable; the
// assigned template's own durations always take priority (see assignedActivityLimit).
const fallbackDurations: Partial<Record<ActivityState, number>> = {
  BREAK: 15,
  LUNCH: 60,
};

function getMonitorEmployees(message: ScreenMonitorPresence): ScreenMonitorEmployee[] {
  if (message.assignedEmployees?.length) return message.assignedEmployees;

  return message.employees.map((employeeId) => ({
    id: employeeId,
    name: employeeId,
    email: employeeId,
    isOnline: true,
    activeMonitorId: employeeId,
  }));
}

function getMonitorOptionValue(employee: ScreenMonitorEmployee) {
  return employee.activeMonitorId || employee.email || employee.id;
}

function selectAvailableMonitorId(current: string, employees: ScreenMonitorEmployee[]) {
  if (employees.some((employee) => getMonitorOptionValue(employee) === current)) {
    return current;
  }

  const firstOnline = employees.find((employee) => employee.isOnline && employee.activeMonitorId);

  return firstOnline?.activeMonitorId || (employees[0] ? getMonitorOptionValue(employees[0]) : "");
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "agent" as Extract<Role, "agent" | "supervisor">,
    organizationName: "",
    organizationAddress: "",
    companyNumber: "",
  });
  const [profileForm, setProfileForm] = useState({ name: "", organizationName: "", organizationAddress: "", companyNumber: "" });
  const [pendingMfaToken, setPendingMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState("");
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeShift, setActiveShift] = useState<ActiveShiftResponse>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [overviewDate, setOverviewDate] = useState(() => toDateKey(new Date()));
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [chatRecipients, setChatRecipients] = useState<User[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatRecipientId, setChatRecipientId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityState>("AVAILABLE");
  const [screenMonitorEmployees, setScreenMonitorEmployees] = useState<ScreenMonitorEmployee[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState("");
  const [monitorStatus, setMonitorStatus] = useState("Disconnected");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isSwitchingStream, setIsSwitchingStream] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(toDateKey(new Date()));
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "annual" as LeaveRequest["leaveType"],
    startDate: toDateKey(new Date()),
    endDate: toDateKey(new Date()),
    reason: "",
  });
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [monitoringStats, setMonitoringStats] = useState<MonitoringStats | null>(null);

  const monitorSocketRef = useRef<WebSocket | null>(null);
  const monitorPresenceSocketRef = useRef<WebSocket | null>(null);
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monitorObjectUrlRef = useRef<string | null>(null);
  const monitoringRef = useRef<MonitoringHandle | null>(null);
  const switchTargetRef = useRef("");
  const switchTimeoutRef = useRef<number | null>(null);
  const awaitingSwitchFrameRef = useRef(false);

  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const canMonitorWorkforce = isAdmin || isSupervisor;
  const currentShiftId = activeShift?.shift._id;
  const currentActivity = getActivityFromEvent(activeShift?.currentState);
  const currentState = activityOptions.find((item) => item.value === currentActivity)?.label || "Offline";
  const activityStart = getActivityStart(events, currentActivity, activeShift);
  const elapsedSeconds = activityStart
    ? Math.max(0, Math.floor((now - new Date(activityStart).getTime()) / 1000))
    : 0;
  const activeSchedule = activeShift?.shift.scheduleId
    ? schedules.find((schedule) => schedule._id === activeShift.shift.scheduleId)
    : schedules.find((schedule) => toDateKey(schedule.workDate) === toDateKey(new Date()));
  const activeTemplate = activeSchedule ? getScheduleTemplate(activeSchedule) : null;

  // The assigned template's own duration is authoritative for both static and
  // dynamic breaks (static windows are resolved server-side into durations).
  const assignedBreak = currentActivity === "BREAK" || currentActivity === "LUNCH"
    ? activeTemplate?.breaks.find(
        (breakItem) =>
          (((breakItem.type || "break") === "lunch" ? "LUNCH" : "BREAK") === currentActivity)
      )
    : undefined;
  const assignedActivityLimit = assignedBreak?.durationMinutes;
  // A 0-minute allowance is meaningful ("work through"); only an absent one
  // falls back to the generic caps.
  const maxDuration =
    typeof assignedActivityLimit === "number"
      ? assignedActivityLimit
      : fallbackDurations[currentActivity];
  const remainingSeconds = maxDuration ? maxDuration * 60 - elapsedSeconds : null;
  const isOvertimeActivity = remainingSeconds !== null && remainingSeconds < 0;
  const selectedTransitionAllowed = allowedTransitions[currentActivity].includes(selectedActivity);
  const approvedLeaveRequests = leaveRequests.filter((request) => request.status === "approved");
  const myLeaveRequests = isAdmin ? leaveRequests : leaveRequests.filter((request) => request.userId === user?._id);
  const selectedConversation =
    chatConversations.find((conversation) => conversation._id === selectedConversationId) || null;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-second ticking only while a shift is actually running.
  useEffect(() => {
    if (!activeShift) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeShift?.shift._id]);

  useEffect(() => {
    const next = allowedTransitions[currentActivity][0] || "AVAILABLE";
    setSelectedActivity(next);
  }, [currentActivity]);

  useEffect(() => {
    if (!user) return;

    const groups = navGroupsForRole(user.role);
    const first = groups[0]?.items[0]?.key;
    if (first && !String(first).startsWith("link:")) {
      setActiveSection(first as SectionKey);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === "supervisor") {
      setProfileForm({ name: user.name, organizationName: user.organizationName || "", organizationAddress: user.organizationAddress || "", companyNumber: user.companyNumber || "" });
    }
  }, [user]);

  // Presence socket: admins and supervisors see which agents are online.
  useEffect(() => {
    if (!token || !canMonitorWorkforce || !user?._id) {
      monitorPresenceSocketRef.current?.close();
      monitorPresenceSocketRef.current = null;
      setScreenMonitorEmployees([]);
      setSelectedMonitorId("");
      return;
    }

    const url = new URL(getScreenMonitorWsUrl());
    url.searchParams.set("type", "admin");
    url.searchParams.set("id", `presence-${user._id}`);
    url.searchParams.set("token", token);

    const socket = new WebSocket(url.toString());
    monitorPresenceSocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ScreenMonitorPresence;
        if (message.type !== "presence") return;

        const monitorEmployees = getMonitorEmployees(message);
        setScreenMonitorEmployees(monitorEmployees);
        setSelectedMonitorId((current) => selectAvailableMonitorId(current, monitorEmployees));
      } catch {
        // Presence messages are JSON only; binary frames use the dedicated stream socket.
      }
    };

    socket.onclose = () => {
      if (monitorPresenceSocketRef.current === socket) {
        monitorPresenceSocketRef.current = null;
      }
    };

    return () => {
      socket.close();
      if (monitorPresenceSocketRef.current === socket) {
        monitorPresenceSocketRef.current = null;
      }
    };
  }, [canMonitorWorkforce, token, user?._id]);

  // Admins and hiring managers keep presence and worker statuses fresh with a
  // light poll; only hiring managers also refresh the overview table here.
  useEffect(() => {
    if (!token || !canMonitorWorkforce) return;

    const timer = window.setInterval(() => {
      if (isSupervisor) {
        void apiRequest<AdminOverview>(`/api/execution/admin/overview?date=${overviewDate}`, {
          token,
        })
          .then(setAdminOverview)
          .catch(() => undefined);
      }

      const presenceSocket = monitorPresenceSocketRef.current;
      if (presenceSocket?.readyState === WebSocket.OPEN) {
        presenceSocket.send(JSON.stringify({ action: "GET_PRESENCE" }));
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [canMonitorWorkforce, isSupervisor, overviewDate, token]);

  // Shift monitoring runs for the whole active shift: mouse tracking from
  // Available to End shift plus the randomized screenshot schedule.
  useEffect(() => {
    const shiftId = currentShiftId;

    if (!token || !user || isSupervisor || !shiftId) {
      monitoringRef.current?.stop();
      monitoringRef.current = null;
      if (!shiftId) setMonitoringStats(null);
      return;
    }

    if (monitoringRef.current?.shiftId === shiftId) return;

    monitoringRef.current?.stop();
    monitoringRef.current = createMonitoringSession({
      token,
      shiftId,
      plannedEndTime: activeShift?.shift.scheduledEndTime || null,
      onState: setMonitoringStats,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShiftId, isSupervisor, token, user?._id]);

  useEffect(() => {
    const release = () => {
      monitoringRef.current?.stop();
      monitoringRef.current = null;
    };

    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      stopScreenMonitor();
      revokeMonitorObjectUrl();
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (currentUser.accountStatus === "pending") {
        return currentUser;
      }

      if (!currentUser.mfaEnabled && currentUser.role !== "supervisor") {
        await startMfaSetup(authToken);
        return currentUser;
      }

      await refreshWorkspace(authToken, currentUser);
      return currentUser;
    });
  }

  async function refreshWorkspace(authToken = token, currentUser = user) {
    if (!authToken || !currentUser) return;

    if (currentUser.role === "supervisor") {
      const overview = await apiRequest<AdminOverview>(`/api/execution/admin/overview?date=${overviewDate}`, {
        token: authToken,
      });

      setAdminOverview(overview);
      await refreshChat(authToken, selectedConversationId);
      setActiveShift(null);
      setDailyPerformance(null);
      setEvents([]);
      setSchedules([]);
      setTemplates([]);
      setUsers([]);
      setLeaveRequests([]);
      return;
    }

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
    await refreshChat(authToken, selectedConversationId);

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
      const [templateList, scheduleList, userList, overview, leaveList] = await Promise.all([
        apiRequest<ShiftTemplate[]>("/api/scheduling/templates", { token: authToken }),
        apiRequest<Schedule[]>("/api/scheduling/schedule", { token: authToken }),
        apiRequest<User[]>("/api/auth/users", { token: authToken }),
        apiRequest<AdminOverview>(`/api/execution/admin/overview?date=${overviewDate}`, { token: authToken }),
        apiRequest<LeaveRequest[]>("/api/leave", { token: authToken }),
      ]);

      setTemplates(templateList);
      setSchedules(scheduleList);
      setUsers(userList);
      setAdminOverview(overview);
      setLeaveRequests(leaveList);
      return;
    }

    const mySchedules = await apiRequest<Schedule[]>("/api/scheduling/schedule/me", {
      token: authToken,
    });
    const myLeave = await apiRequest<LeaveRequest[]>("/api/leave/me", {
      token: authToken,
    });
    setSchedules(mySchedules);
    setLeaveRequests(myLeave);
    setTemplates([]);
    setUsers([]);
    setAdminOverview(null);
  }

  async function refreshChat(authToken = token, conversationId = selectedConversationId) {
    if (!authToken) return;

    const [recipientList, conversationList] = await Promise.all([
      apiRequest<User[]>("/api/chat/recipients", { token: authToken }),
      apiRequest<ChatConversation[]>("/api/chat/conversations", { token: authToken }),
    ]);

    setChatRecipients(recipientList);
    setChatConversations(conversationList);
    setChatRecipientId((current) =>
      recipientList.some((recipient) => recipient._id === current)
        ? current
        : recipientList[0]?._id || ""
    );

    const activeConversationId =
      conversationId && conversationList.some((conversation) => conversation._id === conversationId)
        ? conversationId
        : conversationList[0]?._id || null;

    setSelectedConversationId(activeConversationId);

    if (activeConversationId) {
      const messageList = await apiRequest<ChatMessage[]>(
        `/api/chat/conversations/${activeConversationId}/messages`,
        { token: authToken }
      );
      setChatMessages(messageList);
    } else {
      setChatMessages([]);
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authMode === "register" && !STRONG_PASSWORD_REGEX.test(authForm.password)) {
      notify("error", STRONG_PASSWORD_HINT);
      return;
    }

    if (authMode === "register" && authForm.password !== authForm.confirmPassword) {
      notify("error", "Passwords do not match");
      return;
    }

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authForm.email, password: authForm.password }
        : {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            role: authForm.role,
            ...(authForm.role === "supervisor" ? { organizationName: authForm.organizationName } : {}),
            ...(authForm.role === "supervisor" ? { organizationAddress: authForm.organizationAddress, companyNumber: authForm.companyNumber } : {}),
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

    if (result.mfaRequired && result.mfaToken) {
      setPendingMfaToken(result.mfaToken);
      notify("success", "Enter your authenticator code");
      return;
    }

    if (!result.token) return;

    window.localStorage.setItem("workforce_token", result.token);
    setToken(result.token);
    setUser(result.user);
    setPendingMfaToken(null);
    setMfaCode("");

    if (result.user.accountStatus === "pending") {
      notify("success", "Your hiring manager account is awaiting admin approval");
      return;
    }

    if (result.user.role !== "supervisor" && (result.mfaSetupRequired || !result.user.mfaEnabled)) {
      await startMfaSetup(result.token);
      return;
    }

    await refreshWorkspace(result.token, result.user);
  }

  async function saveHiringManagerProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const updatedUser = await runAction(
      () => apiRequest<User>("/api/auth/me/profile", {
        method: "PUT",
        token,
        body: profileForm,
      }),
      "Profile updated"
    );

    if (updatedUser) setUser(updatedUser);
  }

  async function verifyPendingMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMfaToken) return;

    const result = await runAction(
      () =>
        apiRequest<AuthResponse>("/api/auth/mfa/verify", {
          method: "POST",
          body: {
            mfaToken: pendingMfaToken,
            code: mfaCode,
          },
        }),
      "Authenticator code verified"
    );

    if (!result?.token) return;

    window.localStorage.setItem("workforce_token", result.token);
    setToken(result.token);
    setUser(result.user);
    setPendingMfaToken(null);
    setMfaCode("");
    await refreshWorkspace(result.token, result.user);
  }

  async function startMfaSetup(authToken = token) {
    if (user?.role === "supervisor") return;
    if (!authToken) return;

    const setup = await runAction(
      () =>
        apiRequest<MfaSetup>("/api/auth/mfa/setup", {
          method: "POST",
          token: authToken,
        }),
      "Authenticator setup started"
    );

    if (setup) {
      setMfaSetup(setup);
    }
  }

  async function confirmMfaSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const result = await runAction(
      () =>
        apiRequest<AuthResponse>("/api/auth/mfa/confirm", {
          method: "POST",
          token,
          body: { code: mfaSetupCode },
        }),
      "Authenticator enabled"
    );

    if (result?.user && result.token) {
      window.localStorage.setItem("workforce_token", result.token);
      setToken(result.token);
      setUser(result.user);
      setMfaSetup(null);
      setMfaSetupCode("");
      await refreshWorkspace(result.token, result.user);
    }
  }

  async function deleteUserAccount(member: User) {
    if (!token || !isAdmin) return;

    if (member._id === user?._id) {
      notify("error", "You cannot delete your own account");
      return;
    }

    if (member.role === "admin") {
      notify("error", "Admin accounts cannot be deleted from the dashboard");
      return;
    }

    if (
      !window.confirm(
        `Delete ${member.name}'s account permanently? This removes their schedules, shifts, leave requests, and chat history.`
      )
    ) {
      return;
    }

    await runAction(async () => {
      await apiRequest<{ deletedUserId: string }>(`/api/auth/users/${member._id}`, {
        method: "DELETE",
        token,
      });
      setSelectedConversationId(null);
      setChatMessages([]);
      await refreshWorkspace();
    }, `${member.name} deleted`);
  }

  async function approveUserAccount(member: User) {
    if (!token || !isAdmin) return;

    await runAction(async () => {
      await apiRequest<User>(`/api/auth/users/${member._id}/approve`, {
        method: "PUT",
        token,
      });
      await refreshWorkspace();
    }, `${member.name} approved`);
  }

  async function assignAgentsToManager(manager: User, agentIds: string[]) {
    if (!token || !isAdmin) return;

    await runAction(async () => {
      await apiRequest<User>(`/api/auth/users/${manager._id}/assigned-agents`, {
        method: "PUT",
        token,
        body: { agentIds },
      });
      await refreshWorkspace();
    }, `${manager.name}'s agents updated`);
  }

  async function updateAgentMonitorId(agent: User, monitorId: string) {
    if (!token || !isAdmin) return;

    await runAction(async () => {
      await apiRequest<User>(`/api/auth/users/${agent._id}/monitor-id`, {
        method: "PUT",
        token,
        body: { monitorId },
      });
      await refreshWorkspace();
    }, `${agent.name}'s monitor ID updated`);
  }

  async function startSelectedActivity() {
    if (!token) return;

    if (!selectedTransitionAllowed) {
      notify("error", `Invalid transition from ${currentState} to ${selectedActivity}`);
      return;
    }

    const endingShift = selectedActivity === "END_SHIFT";

    await runAction(async () => {
      if (!activeShift && selectedActivity === "AVAILABLE") {
        await apiRequest("/api/attendance/shift/start", {
          method: "POST",
          token,
        });
      } else if (currentShiftId) {
        await apiRequest("/api/attendance/activity/start", {
          method: "POST",
          token,
          body: {
            shiftId: currentShiftId,
            activityType: selectedActivity,
          },
        });

        if (endingShift) {
          // Stop local tracking immediately; the server closes its session too.
          monitoringRef.current?.stop();
          monitoringRef.current = null;
        }
      }

      await refreshWorkspace();
    }, `${activityOptions.find((item) => item.value === selectedActivity)?.label} started`);
  }

  async function submitLeaveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    await runAction(async () => {
      await apiRequest<LeaveRequest>("/api/leave", {
        method: "POST",
        token,
        body: leaveForm,
      });
      setLeaveForm((current) => ({ ...current, reason: "" }));
      await refreshWorkspace();
    }, "Leave request submitted");
  }

  async function reviewLeave(requestId: string, status: "approved" | "rejected") {
    if (!token || !isAdmin) return;

    await runAction(async () => {
      await apiRequest<LeaveRequest>(`/api/leave/${requestId}/review`, {
        method: "PUT",
        token,
        body: {
          status,
          managerComment: reviewComments[requestId] || "",
        },
      });
      await refreshWorkspace();
    }, `Leave ${status}`);
  }

  async function selectConversation(conversationId: string) {
    if (!token) return;

    setSelectedConversationId(conversationId);
    await runAction(async () => {
      const messageList = await apiRequest<ChatMessage[]>(
        `/api/chat/conversations/${conversationId}/messages`,
        { token }
      );
      setChatMessages(messageList);
      await refreshChat(token, conversationId);
    });
  }

  async function startConversation() {
    if (!token || !chatRecipientId) return;

    await runAction(async () => {
      const conversation = await apiRequest<ChatConversation>("/api/chat/conversations", {
        method: "POST",
        token,
        body: { recipientId: chatRecipientId },
      });
      setSelectedConversationId(conversation._id);
      await refreshChat(token, conversation._id);
    }, "Conversation ready");
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const recipientId = selectedConversation?.otherParticipant?._id || chatRecipientId;
    if (!recipientId || !chatDraft.trim()) return;

    const body = chatDraft.trim();
    setChatDraft("");

    await runAction(async () => {
      await apiRequest<ChatMessage>("/api/chat/messages", {
        method: "POST",
        token,
        body: { recipientId, body },
      });

      const conversation = await apiRequest<ChatConversation>("/api/chat/conversations", {
        method: "POST",
        token,
        body: { recipientId },
      });
      setSelectedConversationId(conversation._id);
      await refreshChat(token, conversation._id);
    });
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
    const authToken = token;
    stopScreenMonitor();
    monitoringRef.current?.stop();
    monitoringRef.current = null;
    setMonitoringStats(null);
    if (authToken) {
      void apiRequest<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
        token: authToken,
      }).catch(() => undefined);
    }
    window.localStorage.removeItem("workforce_token");
    setToken(null);
    setUser(null);
    setUsers([]);
    setActiveShift(null);
    setEvents([]);
    setLeaveRequests([]);
    setChatRecipients([]);
    setChatConversations([]);
    setSelectedConversationId(null);
    setChatMessages([]);
    setChatDraft("");
    setScreenMonitorEmployees([]);
    setSelectedMonitorId("");
    setToasts([]);
  }

  function revokeMonitorObjectUrl() {
    if (monitorObjectUrlRef.current) {
      URL.revokeObjectURL(monitorObjectUrlRef.current);
      monitorObjectUrlRef.current = null;
    }
  }

  function clearMonitorCanvas() {
    const canvas = monitorCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawMonitorFrame(blob: Blob) {
    const canvas = monitorCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);
    const previousUrl = monitorObjectUrlRef.current;
    monitorObjectUrlRef.current = objectUrl;

    image.onload = () => {
      canvas.width = image.naturalWidth || 1280;
      canvas.height = image.naturalHeight || 720;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      // After a switch the server only relays the new worker's frames, so the
      // first drawn frame is the moment the new stream is truly visible.
      if (awaitingSwitchFrameRef.current) {
        clearStreamSwitch();
        setMonitorStatus("Live");
      }

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (monitorObjectUrlRef.current === objectUrl) {
        monitorObjectUrlRef.current = null;
      }
    };

    image.src = objectUrl;
  }

  function stopScreenMonitor() {
    const socket = monitorSocketRef.current;

    clearStreamSwitch();

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: "STOP_STREAM", id: selectedMonitorId }));
      socket.close(1000, "Admin closed stream");
    } else if (socket) {
      socket.close();
    }

    monitorSocketRef.current = null;
    setIsMonitoring(false);
    setMonitorStatus("Disconnected");
    clearMonitorCanvas();
    revokeMonitorObjectUrl();
  }

  function clearStreamSwitch() {
    switchTargetRef.current = "";
    awaitingSwitchFrameRef.current = false;

    if (switchTimeoutRef.current !== null) {
      window.clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
    }

    setIsSwitchingStream(false);
  }

  // Seamless retarget of the live stream: both verbs ride the socket that is
  // already open, so the connection and canvas survive the hop.
  function switchScreenMonitor(targetValue: string) {
    const socket = monitorSocketRef.current;
    const target = screenMonitorEmployees.find(
      (employee) => getMonitorOptionValue(employee) === targetValue
    );

    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !target?.isOnline ||
      !target.activeMonitorId ||
      targetValue === selectedMonitorId ||
      isSwitchingStream
    ) {
      setSelectedMonitorId(targetValue);
      return;
    }

    switchTargetRef.current = targetValue;
    setIsSwitchingStream(true);
    setMonitorStatus("Switching");
    socket.send(JSON.stringify({ action: "STOP_STREAM", id: selectedMonitorId }));
    socket.send(JSON.stringify({ action: "START_STREAM", id: targetValue }));
    setSelectedMonitorId(targetValue);

    // If the new agent never answers, fall back to ending the stream.
    switchTimeoutRef.current = window.setTimeout(() => {
      if (!switchTargetRef.current) return;

      notify("error", "Screen switch timed out");
      stopScreenMonitor();
    }, 10000);
  }

  function handleMonitorEmployeeChange(employeeId: string) {
    if (isMonitoring) {
      switchScreenMonitor(employeeId);
      return;
    }

    setSelectedMonitorId(employeeId);
  }

  function startScreenMonitor() {
    if (!token || !selectedMonitorId) return;

    stopScreenMonitor();
    setMonitorStatus("Connecting");

    const url = new URL(getScreenMonitorWsUrl());
    url.searchParams.set("type", "admin");
    url.searchParams.set("id", selectedMonitorId);
    url.searchParams.set("token", token);

    const socket = new WebSocket(url.toString());
    monitorSocketRef.current = socket;
    socket.binaryType = "blob";

    socket.onopen = () => {
      setIsMonitoring(true);
      setMonitorStatus("Live");
      socket.send(JSON.stringify({ action: "START_STREAM", id: selectedMonitorId }));
    };

    socket.onmessage = (event) => {
      if (event.data instanceof Blob) {
        drawMonitorFrame(event.data);
        return;
      }

      try {
        const message = JSON.parse(String(event.data)) as {
          type?: string;
          event?: string;
          message?: string;
          employees?: string[];
          assignedEmployees?: ScreenMonitorEmployee[];
        };

        if (message.type === "presence") {
          const monitorEmployees = getMonitorEmployees({
            type: "presence",
            employees: message.employees || [],
            assignedEmployees: message.assignedEmployees,
          });
          setScreenMonitorEmployees(monitorEmployees);
          setSelectedMonitorId((current) => selectAvailableMonitorId(current, monitorEmployees));
          return;
        }

        if (message.type === "stream" && message.event === "started") {
          // The server has re-targeted the watcher; frames from here on belong
          // to the new worker. The switch overlay clears on the first frame.
          if (switchTargetRef.current) {
            awaitingSwitchFrameRef.current = true;
          }
          setMonitorStatus("Live");
          return;
        }

        if (message.event === "employee_unavailable" || message.event === "employee_offline") {
          notify("error", "Selected employee is not available for monitoring");
          stopScreenMonitor();
          return;
        }

        if (message.message) {
          setMonitorStatus(message.message);
        }
      } catch {
        setMonitorStatus("Live");
      }
    };

    socket.onerror = () => {
      setMonitorStatus("Connection error");
      notify("error", "Screen monitor connection failed");
    };

    socket.onclose = () => {
      if (monitorSocketRef.current === socket) {
        monitorSocketRef.current = null;
      }
      setIsMonitoring(false);
      setMonitorStatus("Disconnected");
      clearMonitorCanvas();
      revokeMonitorObjectUrl();
    };
  }

  function refreshOverviewDate(date: string) {
    setOverviewDate(date);
    void runAction(async () => {
      const overview = await apiRequest<AdminOverview>(`/api/execution/admin/overview?date=${date}`, { token });
      setAdminOverview(overview);
    });
  }

  const monitoringAgents = useMemo(() => {
    if (!canMonitorWorkforce) return [];
    if (isAdmin) return users.filter((member) => member.role === "agent");
    return adminOverview?.users.map((item) => item.user) || [];
  }, [adminOverview, canMonitorWorkforce, isAdmin, users]);

  function renderSection() {
    if (!user || !token) return null;

    const chatPanel = (
      <ChatPanel
        conversations={chatConversations}
        currentUser={user}
        draft={chatDraft}
        loading={loading}
        messages={chatMessages}
        recipients={chatRecipients}
        selectedConversationId={selectedConversationId}
        selectedRecipientId={chatRecipientId}
        onChangeDraft={setChatDraft}
        onChangeRecipient={setChatRecipientId}
        onRefresh={() => refreshChat()}
        onSelectConversation={selectConversation}
        onSendMessage={sendChatMessage}
        onStartConversation={startConversation}
      />
    );

    const overviewPanel = adminOverview ? (
      <AdminOverviewPanel
        canDownload={isAdmin}
        loading={loading}
        overview={adminOverview}
        selectedDate={overviewDate}
        onSelectDate={refreshOverviewDate}
        onRunMaintenance={isAdmin ? runMaintenance : undefined}
      />
    ) : null;

    const screenMonitorPanel = (
      <ScreenMonitorPanel
        canvasRef={monitorCanvasRef}
        employees={screenMonitorEmployees}
        isMonitoring={isMonitoring}
        isSwitching={isSwitchingStream}
        selectedEmployeeId={selectedMonitorId}
        status={monitorStatus}
        onChangeEmployee={handleMonitorEmployeeChange}
        onStart={startScreenMonitor}
        onStop={stopScreenMonitor}
      />
    );

    const activityMonitoringPanel = (
      <MonitoringPanel agents={monitoringAgents} token={token} />
    );

    const liveExecutionPanel = (
      <LiveExecutionPanel
        activeShift={activeShift}
        activeSchedule={activeSchedule}
        activityTone={activityTone}
        attendanceTone={attendanceTone}
        currentActivity={currentActivity}
        currentState={currentState}
        dailyPerformance={dailyPerformance}
        elapsedSeconds={elapsedSeconds}
        isOvertimeActivity={isOvertimeActivity}
        loading={loading}
        maxDuration={maxDuration}
        monitoring={monitoringStats}
        remainingSeconds={remainingSeconds}
        selectedActivity={selectedActivity}
        selectedTransitionAllowed={selectedTransitionAllowed}
        onChangeActivity={setSelectedActivity}
        onStartActivity={startSelectedActivity}
        onRetryCapture={() => monitoringRef.current?.requestCapture()}
      />
    );

    switch (activeSection) {
      case "overview":
        if (isSupervisor || isAdmin) return overviewPanel;
        return (
          <div className="stack">
            <div className="dashboard-grid">
              <MonthlyActivityCalendar
                activeShift={activeShift}
                dailyPerformance={dailyPerformance}
                events={events}
                leaveRequests={approvedLeaveRequests}
                schedules={schedules}
                selectedDay={selectedCalendarDay}
                onSelectDay={setSelectedCalendarDay}
              />
              <AssignedSchedules schedules={schedules} users={[user]} />
            </div>
          </div>
        );

      case "my-shift":
        return (
          <div className="stack">
            {liveExecutionPanel}
            <div className="dashboard-grid">
              <ShiftEventsPanel events={events} />
              {dailyPerformance && <PerformancePanel performance={dailyPerformance} />}
            </div>
          </div>
        );

      case "scheduling":
        return (
          <div className="stack">
            <SchedulingSetupPanel
              leaveRequests={leaveRequests}
              loading={loading}
              notify={notify}
              onRefresh={refreshWorkspace}
              schedules={schedules}
              templates={templates}
              token={token}
              users={users}
            />
            <ScheduleSummary schedules={schedules} users={users} />
          </div>
        );

      case "screen-monitor":
        return screenMonitorPanel;

      case "activity-monitoring":
        return activityMonitoringPanel;

      case "leave":
        return (
          <LeavePanel
            isAdmin={Boolean(isAdmin)}
            leaveForm={leaveForm}
            leaveRequests={myLeaveRequests}
            loading={loading}
            reviewComments={reviewComments}
            users={users}
            onChangeLeaveForm={setLeaveForm}
            onChangeReviewComment={setReviewComments}
            onReview={reviewLeave}
            onSubmitLeave={submitLeaveRequest}
          />
        );

      case "chat":
        return chatPanel;

      case "accounts":
        return (
          <div className="stack">
            <HiringManagerAgentAllocationPanel
              loading={loading}
              users={users}
              onAssignAgents={assignAgentsToManager}
            />
            <UserAccountsPanel
              currentUserId={user._id}
              loading={loading}
              users={users}
              onApproveUser={approveUserAccount}
              onDeleteUser={deleteUserAccount}
              onUpdateAgentMonitorId={updateAgentMonitorId}
            />
          </div>
        );

      case "profile":
        return (
          <section className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <UserRound size={20} />
                <div>
                  <h2>My Profile</h2>
                  <p className="panel-subtitle">Keep your organisation details up to date.</p>
                </div>
              </div>
            </div>
            <form className="form-grid" onSubmit={saveHiringManagerProfile}>
              <div className="field"><label htmlFor="profile-name">Name</label><input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} required /></div>
              <div className="field"><label htmlFor="profile-email">Email</label><input id="profile-email" type="email" value={user.email} disabled /></div>
              <div className="field"><label htmlFor="profile-organization">Organisation name</label><input id="profile-organization" value={profileForm.organizationName} onChange={(event) => setProfileForm((current) => ({ ...current, organizationName: event.target.value }))} required /></div>
              <div className="field"><label htmlFor="profile-address">Organisation address</label><textarea id="profile-address" value={profileForm.organizationAddress} onChange={(event) => setProfileForm((current) => ({ ...current, organizationAddress: event.target.value }))} required /></div>
              <div className="field"><label htmlFor="profile-company-number">Company number</label><input id="profile-company-number" value={profileForm.companyNumber} onChange={(event) => setProfileForm((current) => ({ ...current, companyNumber: event.target.value }))} required /></div>
              <button className="button" type="submit" disabled={loading}>Save profile</button>
            </form>
          </section>
        );

      default:
        return overviewPanel;
    }
  }

  if (!token || !user) {
    return (
      <>
        <DesktopOnlyNotice />
        <main className="auth-wrap">
          <ToastStack toasts={toasts} />
          <section className="auth-panel">
            <div className="brand">
              <div className="brand-mark brand-mark-img">
                <img alt="" src="/shiftsync-icon.png" />
              </div>
              <div>
                <h1>ShiftSync</h1>
                <p>Execution dashboard for scheduled teams</p>
              </div>
            </div>

            <div className="auth-switch" aria-label="Authentication mode">
              <button
                className={authMode === "login" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setPendingMfaToken(null);
                }}
              >
                Login
              </button>
              <button
                className={authMode === "register" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setPendingMfaToken(null);
                }}
              >
                Register
              </button>
            </div>

            {pendingMfaToken ? (
              <form onSubmit={verifyPendingMfa}>
                <div className="field">
                  <label htmlFor="mfa-code">Authenticator code</label>
                  <input
                    id="mfa-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <button className="button full" disabled={loading || mfaCode.length !== 6} type="submit">
                  <KeyRound size={17} />
                  Verify code
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuth}>
                {authMode === "register" && (
                  <>
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

                    <div className="field">
                      <label htmlFor="role">Role</label>
                      <select
                        id="role"
                        value={authForm.role}
                        onChange={(event) =>
                          setAuthForm((current) => ({
                            ...current,
                            role: event.target.value as Extract<Role, "agent" | "supervisor">,
                          }))
                        }
                      >
                        <option value="agent">Agent</option>
                        <option value="supervisor">Hiring manager</option>
                      </select>
                    </div>

                    {authForm.role === "supervisor" && (
                      <>
                        <div className="field">
                          <label htmlFor="organization-name">Organisation name</label>
                          <input id="organization-name" value={authForm.organizationName} onChange={(event) => setAuthForm((current) => ({ ...current, organizationName: event.target.value }))} required />
                        </div>
                        <div className="field">
                          <label htmlFor="organization-address">Organisation address</label>
                          <textarea id="organization-address" value={authForm.organizationAddress} onChange={(event) => setAuthForm((current) => ({ ...current, organizationAddress: event.target.value }))} required />
                        </div>
                        <div className="field">
                          <label htmlFor="company-number">Company number</label>
                          <input id="company-number" value={authForm.companyNumber} onChange={(event) => setAuthForm((current) => ({ ...current, companyNumber: event.target.value }))} required />
                        </div>
                      </>
                    )}
                  </>
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
                      minLength={authMode === "register" ? 12 : undefined}
                      pattern={authMode === "register" ? STRONG_PASSWORD_PATTERN : undefined}
                      title={authMode === "register" ? STRONG_PASSWORD_HINT : undefined}
                      aria-describedby={authMode === "register" ? "password-requirements" : undefined}
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
                  {authMode === "register" && (
                    <p id="password-requirements" className="muted-text">
                      {STRONG_PASSWORD_HINT}
                    </p>
                  )}
                </div>

                {authMode === "register" && (
                  <div className="field">
                    <label htmlFor="confirm-password">Confirm password</label>
                    <div className="password-field">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={authForm.confirmPassword}
                        onChange={(event) =>
                          setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))
                        }
                        minLength={12}
                        pattern={STRONG_PASSWORD_PATTERN}
                        title="Repeat your password exactly"
                        required
                      />
                      <button
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        className="password-toggle"
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                      >
                        {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                )}

                <button className="button full" disabled={loading} type="submit">
                  <LogIn size={17} />
                  {authMode === "login" ? "Sign in" : "Create account"}
                </button>
              </form>
            )}
          </section>
        </main>
      </>
    );
  }

  if (user.accountStatus === "pending") {
    return (
      <>
        <DesktopOnlyNotice />
        <main className="auth-wrap">
          <ToastStack toasts={toasts} />
          <section className="auth-panel">
            <div className="brand">
              <div className="brand-mark brand-mark-img">
                <img alt="" src="/shiftsync-icon.png" />
              </div>
              <div>
                <h1>ShiftSync</h1>
                <p>Hiring manager approval pending</p>
              </div>
            </div>
            <p className="muted">
              Your hiring manager account was created successfully. An admin must approve it before
              the dashboard becomes available.
            </p>
            <button className="button full" type="button" onClick={logout}>
              <LogOut size={17} />
              Sign out
            </button>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <DesktopOnlyNotice />
      <ToastStack toasts={toasts} />
      <DashboardShell
        user={user}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onRefresh={() => refreshWorkspace()}
        onLogout={logout}
        onRequestMfa={() => startMfaSetup()}
      >
        {mfaSetup && (
          <div className="modal-backdrop">
            <section className="auth-panel mfa-modal">
              <div className="panel-title">
                <KeyRound size={20} />
                <div>
                  <h2>Set Up Authenticator</h2>
                  <p className="panel-subtitle">Add this account in Google Authenticator.</p>
                </div>
              </div>

              <div className="mfa-setup-box">
                <span>Setup key</span>
                <strong>{mfaSetup.manualKey}</strong>
              </div>
              <p className="muted">
                In Google Authenticator, choose Enter a setup key, then enter the key above. Use a
                time-based code.
              </p>

              <form onSubmit={confirmMfaSetup}>
                <div className="field">
                  <label htmlFor="mfa-setup-code">6-digit code</label>
                  <input
                    id="mfa-setup-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaSetupCode}
                    onChange={(event) => setMfaSetupCode(event.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <div className="review-actions">
                  <button
                    className="button"
                    disabled={loading || mfaSetupCode.length !== 6}
                    type="submit"
                  >
                    <KeyRound size={17} />
                    Enable MFA
                  </button>
                  <button className="button secondary" type="button" onClick={() => setMfaSetup(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {renderSection()}
      </DashboardShell>
    </>
  );
}
