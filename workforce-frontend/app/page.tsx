"use client";

import { CSSProperties, FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  DoorOpen,
  Download,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LogIn,
  LogOut,
  Maximize2,
  MessageSquare,
  Minimize2,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
  TimerReset,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { apiRequest, formatDate, formatDateTime, getScreenMonitorWsUrl } from "@/lib/api";
import type {
  ActiveShiftResponse,
  AdminOverview,
  ChatConversation,
  ChatMessage,
  DailyPerformance,
  LeaveRequest,
  Schedule,
  ScreenMonitorPresence,
  ShiftEvent,
  ShiftTemplate,
  Role,
  User,
} from "@/types/workforce";

type AuthMode = "login" | "register";
type BreakForm = {
  label: string;
  type: "break" | "lunch";
  mode: "static" | "dynamic";
  startTime: string;
  endTime: string;
  durationMinutes: number;
};
type TemplateActivityForm = {
  label: string;
  type: "meeting" | "training" | "after_call_work";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  enabled: boolean;
};
type Toast = { id: number; type: "success" | "error"; message: string };
type ActivityState =
  | "AVAILABLE"
  | "BREAK"
  | "LUNCH"
  | "MEETING"
  | "TRAINING"
  | "AFTER_CALL_WORK"
  | "OFFLINE"
  | "END_SHIFT";

type AuthResponse = {
  token?: string;
  user: User;
  mfaRequired?: boolean;
  mfaToken?: string;
  mfaSetupRequired?: boolean;
};

function formatRole(role: Role) {
  return role === "supervisor" ? "Hiring manager" : role;
}

function escapeExcelCell(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type MfaSetup = {
  manualKey: string;
  otpauthUrl: string;
};

const eventLabels: Record<ShiftEvent["type"], string> = {
  SHIFT_START: "Shift started",
  WORK_START: "Available",
  BREAK_START: "Break started",
  BREAK_END: "Break ended",
  LUNCH_START: "Lunch started",
  LUNCH_END: "Lunch ended",
  MEETING_START: "Meeting started",
  MEETING_END: "Meeting ended",
  TRAINING_START: "Training started",
  TRAINING_END: "Training ended",
  AFTER_CALL_WORK_START: "After call work started",
  AFTER_CALL_WORK_END: "After call work ended",
  SHIFT_END: "Shift ended",
};

const defaultBreaks: BreakForm[] = [
  {
    label: "Morning break",
    type: "break",
    mode: "static",
    startTime: "10:00",
    endTime: "10:15",
    durationMinutes: 15,
  },
  {
    label: "Lunch",
    type: "lunch",
    mode: "static",
    startTime: "14:00",
    endTime: "15:00",
    durationMinutes: 45,
  },
];

const optionalTemplateActivities: TemplateActivityForm[] = [
  {
    label: "Meeting",
    type: "meeting",
    startTime: "11:00",
    endTime: "11:30",
    durationMinutes: 30,
    enabled: false,
  },
  {
    label: "Training",
    type: "training",
    startTime: "15:00",
    endTime: "15:30",
    durationMinutes: 30,
    enabled: false,
  },
  {
    label: "After call work",
    type: "after_call_work",
    startTime: "16:00",
    endTime: "16:15",
    durationMinutes: 15,
    enabled: false,
  },
];

const activityOptions: { value: ActivityState; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BREAK", label: "Break" },
  { value: "LUNCH", label: "Lunch" },
  { value: "MEETING", label: "Meeting" },
  { value: "TRAINING", label: "Training" },
  { value: "AFTER_CALL_WORK", label: "After call work" },
  { value: "OFFLINE", label: "Offline" },
  { value: "END_SHIFT", label: "End shift" },
];

const allowedTransitions: Record<ActivityState, ActivityState[]> = {
  AVAILABLE: ["BREAK", "LUNCH", "MEETING", "TRAINING", "AFTER_CALL_WORK", "END_SHIFT"],
  BREAK: ["AVAILABLE"],
  LUNCH: ["AVAILABLE"],
  MEETING: ["AVAILABLE"],
  TRAINING: ["AVAILABLE"],
  AFTER_CALL_WORK: ["AVAILABLE"],
  OFFLINE: ["AVAILABLE"],
  END_SHIFT: [],
};

const constrainedDurations: Partial<Record<ActivityState, number>> = {
  BREAK: 15,
  LUNCH: 60,
};

const dynamicBreakDurations = [5, 10, 15, 20, 25, 30, 35, 40, 45];

const activityTone: Partial<Record<ActivityState, string>> = {
  BREAK: "warn",
  LUNCH: "warn",
  END_SHIFT: "danger",
  OFFLINE: "danger",
};

const terminalStartEvents = new Set<ShiftEvent["type"]>([
  "BREAK_START",
  "LUNCH_START",
  "MEETING_START",
  "TRAINING_START",
  "AFTER_CALL_WORK_START",
]);

const BUSINESS_TIME_ZONE = "Europe/London";

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function londonDateParts(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function toDateKey(value: Date | string) {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return dateOnly[0];
  }

  const date = value instanceof Date ? value : new Date(value);
  const parts = londonDateParts(date);
  return dateKeyFromParts(parts.year, parts.month, parts.day);
}

function minutesBetween(start?: string, end?: string) {
  if (!start) return 0;
  const endTime = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((endTime - new Date(start).getTime()) / 60000));
}

function minutesBetweenTimes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 0;

  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  return Math.max(0, endTotal - startTotal);
}

function formatTimeRange(startTime?: string, endTime?: string) {
  const normalizeTime = (time?: string) => {
    const match = time?.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return null;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const normalizedStart = normalizeTime(startTime);
  const normalizedEnd = normalizeTime(endTime);

  if (!normalizedStart || !normalizedEnd) return "Time not set";

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
  const baseDate = "2026-01-01";
  const startDate = new Date(`${baseDate}T${normalizedStart}:00Z`);
  const endDate = new Date(`${baseDate}T${normalizedEnd}:00Z`);

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getActivityFromEvent(eventType?: ShiftEvent["type"] | null): ActivityState {
  if (!eventType) return "OFFLINE";

  if (eventType === "SHIFT_END") return "END_SHIFT";
  if (eventType === "BREAK_START") return "BREAK";
  if (eventType === "LUNCH_START") return "LUNCH";
  if (eventType === "MEETING_START") return "MEETING";
  if (eventType === "TRAINING_START") return "TRAINING";
  if (eventType === "AFTER_CALL_WORK_START") return "AFTER_CALL_WORK";
  return "AVAILABLE";
}

function getActivityStart(events: ShiftEvent[], currentActivity: ActivityState, activeShift: ActiveShiftResponse) {
  if (!activeShift) return undefined;

  if (currentActivity === "AVAILABLE") {
    const lastTerminal = [...events]
      .reverse()
      .find((event) => !terminalStartEvents.has(event.type) && event.type !== "SHIFT_START");
    return lastTerminal?.timestamp || activeShift.shift.clockInTime;
  }

  const startEvent = [...events]
    .reverse()
    .find((event) => getActivityFromEvent(event.type) === currentActivity);
  return startEvent?.timestamp;
}

function isDateInLeave(date: Date, leave: LeaveRequest) {
  const key = toDateKey(date);
  return key >= toDateKey(leave.startDate) && key <= toDateKey(leave.endDate);
}

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
    role: "agent" as Extract<Role, "agent" | "supervisor">,
  });
  const [pendingMfaToken, setPendingMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState("");
  const [templateForm, setTemplateForm] = useState({
    name: "Day Operations",
    startTime: "08:00",
    endTime: "17:00",
    breakCount: 1,
    breaks: defaultBreaks.slice(0, 1),
    activities: optionalTemplateActivities,
  });
  const [scheduleForm, setScheduleForm] = useState({
    userId: "",
    shiftTemplateId: "",
    workDates: [new Date().toISOString().slice(0, 10)],
  });
  const [scheduleDeleteForm, setScheduleDeleteForm] = useState({
    userId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeShift, setActiveShift] = useState<ActiveShiftResponse>(null);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [chatRecipients, setChatRecipients] = useState<User[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatRecipientId, setChatRecipientId] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityState>("AVAILABLE");
  const [onlineMonitorIds, setOnlineMonitorIds] = useState<string[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState("");
  const [monitorStatus, setMonitorStatus] = useState("Disconnected");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(toDateKey(new Date()));
  const [assignmentMonth, setAssignmentMonth] = useState(toDateKey(new Date()).slice(0, 7));
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
  const monitorSocketRef = useRef<WebSocket | null>(null);
  const monitorPresenceSocketRef = useRef<WebSocket | null>(null);
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monitorObjectUrlRef = useRef<string | null>(null);

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
  const activeTemplate =
    activeSchedule && typeof activeSchedule.shiftTemplateId !== "string"
      ? activeSchedule.shiftTemplateId
      : null;
  const assignedActivityLimit =
    currentActivity === "BREAK" || currentActivity === "LUNCH"
      ? activeTemplate?.breaks.find(
          (breakItem) =>
            ((breakItem.type || "break") === "lunch" ? "LUNCH" : "BREAK") === currentActivity &&
            (breakItem.mode || "static") === "dynamic"
        )?.durationMinutes
      : undefined;
  const maxDuration = assignedActivityLimit || constrainedDurations[currentActivity];
  const remainingSeconds = maxDuration ? maxDuration * 60 - elapsedSeconds : null;
  const isOvertimeActivity = remainingSeconds !== null && remainingSeconds < 0;
  const selectedTransitionAllowed = allowedTransitions[currentActivity].includes(selectedActivity);
  const approvedLeaveRequests = leaveRequests.filter((request) => request.status === "approved");
  const myLeaveRequests = isAdmin
    ? leaveRequests
    : leaveRequests.filter((request) => request.userId === user?._id);
  const selectedConversation =
    chatConversations.find((conversation) => conversation._id === selectedConversationId) || null;
  const selectedTemplateBreaks = templateForm.breaks.slice(0, templateForm.breakCount);
  const selectedTemplateActivities = templateForm.activities.filter((activity) => activity.enabled);

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
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const next = allowedTransitions[currentActivity][0] || "AVAILABLE";
    setSelectedActivity(next);
  }, [currentActivity]);

  useEffect(() => {
    if (!user || isAdmin || scheduleForm.userId) return;
    setScheduleForm((current) => ({ ...current, userId: user._id }));
  }, [isAdmin, scheduleForm.userId, user]);

  useEffect(() => {
    if (!token || !canMonitorWorkforce || !user?._id) {
      monitorPresenceSocketRef.current?.close();
      monitorPresenceSocketRef.current = null;
      setOnlineMonitorIds([]);
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

        setOnlineMonitorIds(message.employees);
        setSelectedMonitorId((current) =>
          current && message.employees.includes(current) ? current : message.employees[0] || ""
        );
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

  useEffect(() => {
    return () => {
      stopScreenMonitor();
      revokeMonitorObjectUrl();
    };
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
      const overview = await apiRequest<AdminOverview>("/api/execution/admin/overview", {
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
        apiRequest<AdminOverview>("/api/execution/admin/overview", { token: authToken }),
        apiRequest<LeaveRequest[]>("/api/leave", { token: authToken }),
      ]);

      setTemplates(templateList);
      setSchedules(scheduleList);
      setUsers(userList);
      setAdminOverview(overview);
      setLeaveRequests(leaveList);

      setScheduleForm((current) => ({
        ...current,
        userId: current.userId || userList[0]?._id || "",
        shiftTemplateId: current.shiftTemplateId || templateList[0]?._id || "",
      }));
      setScheduleDeleteForm((current) => ({
        ...current,
        userId: current.userId || userList[0]?._id || "",
      }));
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
    setChatRecipientId((current) => current || recipientList[0]?._id || "");

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

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authForm.email, password: authForm.password }
        : {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            role: authForm.role,
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

  function setBreakCount(count: number) {
    const nextCount = Math.min(4, Math.max(1, count));
    setTemplateForm((current) => {
      const nextBreaks = [...current.breaks];
      while (nextBreaks.length < nextCount) {
        const isLunch = nextBreaks.length === 1;
        nextBreaks.push({
          label: isLunch ? "Lunch" : `Break ${nextBreaks.length + 1}`,
          type: isLunch ? "lunch" : "break",
          mode: "static",
          startTime: isLunch ? "14:00" : "10:00",
          endTime: isLunch ? "14:45" : "10:15",
          durationMinutes: isLunch ? 45 : 15,
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
      breaks: current.breaks.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated = { ...item, [key]: value };
        const durationMinutes =
          updated.mode === "static"
            ? minutesBetweenTimes(updated.startTime, updated.endTime)
            : Number(updated.durationMinutes);

        return {
          ...updated,
          durationMinutes:
            updated.mode === "dynamic"
              ? Math.min(45, Math.max(5, durationMinutes || 15))
              : durationMinutes || updated.durationMinutes,
        };
      }),
    }));
  }

  function toggleScheduleDate(date: string) {
    setScheduleForm((current) => {
      const selected = new Set(current.workDates);

      if (selected.has(date)) {
        selected.delete(date);
      } else {
        selected.add(date);
      }

      return {
        ...current,
        workDates: Array.from(selected).sort(),
      };
    });
  }

  function updateTemplateActivity(
    type: TemplateActivityForm["type"],
    key: keyof TemplateActivityForm,
    value: string | number | boolean
  ) {
    setTemplateForm((current) => ({
      ...current,
      activities: current.activities.map((item) => {
        if (item.type !== type) return item;

        const updated = { ...item, [key]: value };
        const durationMinutes = minutesBetweenTimes(updated.startTime, updated.endTime);

        return {
          ...updated,
          durationMinutes: durationMinutes || updated.durationMinutes,
        };
      }),
    }));
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isAdmin) return;

    const selectedBreaks = templateForm.breaks.slice(0, templateForm.breakCount);
    const selectedActivities = templateForm.activities.filter((item) => item.enabled);

    await runAction(async () => {
      await apiRequest<ShiftTemplate>("/api/scheduling/templates", {
        method: "POST",
        token,
        body: {
          name: templateForm.name,
          startTime: templateForm.startTime,
          endTime: templateForm.endTime,
          breaks: selectedBreaks.map((item, index) => ({
            label: item.label || `Break ${index + 1}`,
            type: item.type,
            mode: item.mode,
            startTime: item.mode === "static" ? item.startTime : undefined,
            endTime: item.mode === "static" ? item.endTime : undefined,
            durationMinutes:
              item.mode === "static"
                ? minutesBetweenTimes(item.startTime, item.endTime) ||
                  Math.min(45, Math.max(5, Number(item.durationMinutes)))
                : Math.min(45, Math.max(5, Number(item.durationMinutes))),
          })),
          activities: selectedActivities.map((item) => ({
            label: item.label,
            type: item.type,
            startTime: item.startTime,
            endTime: item.endTime,
            durationMinutes:
              minutesBetweenTimes(item.startTime, item.endTime) ||
              Math.min(120, Math.max(5, Number(item.durationMinutes))),
          })),
        },
      });
      await refreshWorkspace();
    }, "Template created");
  }

  async function deleteTemplate(template: ShiftTemplate) {
    if (!token || !isAdmin) return;

    const assignedCount = schedules.filter((schedule) => {
      const templateId =
        typeof schedule.shiftTemplateId === "string"
          ? schedule.shiftTemplateId
          : schedule.shiftTemplateId._id;
      return templateId === template._id;
    }).length;

    if (assignedCount) {
      notify("error", "Delete assigned schedules before deleting this template");
      return;
    }

    if (!window.confirm(`Delete ${template.name} template?`)) {
      return;
    }

    await runAction(async () => {
      await apiRequest(`/api/scheduling/templates/${template._id}`, {
        method: "DELETE",
        token,
      });

      setScheduleForm((current) => ({
        ...current,
        shiftTemplateId: current.shiftTemplateId === template._id ? "" : current.shiftTemplateId,
      }));
      await refreshWorkspace();
    }, "Template deleted");
  }

  async function assignSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isAdmin) return;

    if (!scheduleForm.workDates.length) {
      notify("error", "Select at least one work date");
      return;
    }

    await runAction(async () => {
      await apiRequest<Schedule[]>("/api/scheduling/schedule", {
        method: "POST",
        token,
        body: scheduleForm,
      });
      await refreshWorkspace();
    }, "Schedule assigned");
  }

  async function deleteSchedules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isAdmin) return;

    if (scheduleDeleteForm.endDate < scheduleDeleteForm.startDate) {
      notify("error", "End date cannot be before start date");
      return;
    }

    const member = users.find((item) => item._id === scheduleDeleteForm.userId);
    const dateLabel =
      scheduleDeleteForm.startDate === scheduleDeleteForm.endDate
        ? formatDate(scheduleDeleteForm.startDate)
        : `${formatDate(scheduleDeleteForm.startDate)} to ${formatDate(scheduleDeleteForm.endDate)}`;

    if (
      !window.confirm(
        `Delete schedules for ${member?.name || "this user"} from ${dateLabel}?`
      )
    ) {
      return;
    }

    const result = await runAction(async () => {
      const response = await apiRequest<{ deletedCount: number }>("/api/scheduling/schedule", {
        method: "DELETE",
        token,
        body: scheduleDeleteForm,
      });
      await refreshWorkspace();
      return response;
    });

    if (result) {
      notify(
        "success",
        result.deletedCount
          ? `${result.deletedCount} schedule${result.deletedCount === 1 ? "" : "s"} deleted`
          : "No matching schedules found"
      );
    }
  }

  async function deleteSingleSchedule(schedule: Schedule) {
    if (!token || !isAdmin) return;

    const member = users.find((item) => item._id === schedule.userId);
    const workDate = toDateKey(schedule.workDate);

    if (
      !window.confirm(
        `Delete ${formatDate(workDate)} schedule for ${member?.name || "this user"}?`
      )
    ) {
      return;
    }

    const result = await runAction(async () => {
      const response = await apiRequest<{ deletedCount: number }>("/api/scheduling/schedule", {
        method: "DELETE",
        token,
        body: {
          userId: schedule.userId,
          startDate: workDate,
          endDate: workDate,
        },
      });
      await refreshWorkspace();
      return response;
    });

    if (result) {
      notify(
        "success",
        result.deletedCount ? "Schedule deleted" : "No matching schedule found"
      );
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

  async function startSelectedActivity() {
    if (!token) return;

    if (!selectedTransitionAllowed) {
      notify("error", `Invalid transition from ${currentState} to ${selectedActivity}`);
      return;
    }

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
    setOnlineMonitorIds([]);
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
        const message = JSON.parse(String(event.data)) as ScreenMonitorPresence & {
          event?: string;
          message?: string;
        };

        if (message.type === "presence") {
          setOnlineMonitorIds(message.employees);
          setSelectedMonitorId((current) => current || message.employees[0] || "");
          return;
        }

        if (message.event === "employee_unavailable" || message.event === "employee_offline") {
          notify("error", "Selected employee is not available for monitoring");
          stopScreenMonitor();
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

  const dailyPerformancePanel = dailyPerformance ? (
    <PerformancePanel performance={dailyPerformance} />
  ) : null;

  const adminOverviewPanel =
    canMonitorWorkforce && adminOverview ? (
      <AdminOverviewPanel
        canDownload={isAdmin}
        loading={loading}
        overview={adminOverview}
        onRunMaintenance={isAdmin ? runMaintenance : undefined}
      />
    ) : null;

  const liveExecutionPanel = (
    <section className="panel live-execution-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Clock3 size={20} />
          <div>
            <h2>Live Workforce Execution</h2>
            <p className="panel-subtitle">Activity toggle, timers, and adherence enforcement</p>
          </div>
        </div>
        <span className={`pill ${activityTone[currentActivity] || attendanceTone}`}>
          {currentState}
        </span>
      </div>

      <div className="execution-grid">
        <div className="activity-card">
          <div className="activity-head">
            <span>Current activity</span>
            {isOvertimeActivity && (
              <span className="pill danger">
                <AlertTriangle size={14} />
                Overtime
              </span>
            )}
          </div>
          <strong>{currentState}</strong>
          <p>
            {maxDuration
              ? `${maxDuration} minute limit`
              : activeShift
                ? "Tracked as productive availability"
                : "Select Available to check in"}
          </p>
          <div className={`countdown ${isOvertimeActivity ? "danger" : ""}`}>
            <TimerReset size={18} />
            {remainingSeconds === null
              ? formatDuration(elapsedSeconds)
              : remainingSeconds >= 0
                ? formatDuration(remainingSeconds)
                : `+${formatDuration(Math.abs(remainingSeconds))}`}
          </div>
        </div>

        <div className="activity-toggle">
          <div className="field">
            <label htmlFor="activity-select">Activity</label>
            <select
              id="activity-select"
              value={selectedActivity}
              onChange={(event) => setSelectedActivity(event.target.value as ActivityState)}
            >
              {activityOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    option.value === "OFFLINE" ||
                    !allowedTransitions[currentActivity].includes(option.value)
                  }
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="button"
            disabled={loading || !selectedTransitionAllowed}
            type="button"
            onClick={startSelectedActivity}
          >
            <Play size={17} />
            Start Activity
          </button>

          {!selectedTransitionAllowed && (
            <p className="validation-copy">
              Return to Available before moving to another activity. End shift is blocked from
              break, lunch, and auxiliary states.
            </p>
          )}
        </div>
      </div>

      <div className="metrics execution-metrics">
        <div className="metric">
          <span>Scheduled start</span>
          <strong>{formatDateTime(activeShift?.shift.scheduledStartTime)}</strong>
        </div>
        <div className="metric">
          <span>Worked duration</span>
          <strong>
            {activeShift?.shift.totalWorkedMinutes ?? minutesBetween(activeShift?.shift.clockInTime)}m
          </strong>
        </div>
        <div className="metric">
          <span>Break and lunch</span>
          <strong>{activeShift?.shift.totalBreakMinutes ?? dailyPerformance?.breakMinutes ?? 0}m</strong>
        </div>
        <div className="metric">
          <span>Today adherence</span>
          <strong>{dailyPerformance?.adherenceScore ?? dailyPerformance?.overallScore ?? 100}%</strong>
        </div>
      </div>
    </section>
  );

  if (!token || !user) {
    return (
      <>
        <DesktopOnlyNotice />
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
              <div className="brand-mark">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1>Workforce Manager</h1>
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
            {user.name} <span className="pill">{formatRole(user.role)}</span>
          </span>
          {user.role !== "supervisor" && (
            <button className="button secondary" type="button" onClick={() => startMfaSetup()}>
              <KeyRound size={17} />
              {user.mfaEnabled ? "Reset MFA" : "Set up MFA"}
            </button>
          )}
          <button className="icon-button" type="button" onClick={() => refreshWorkspace()}>
            <RefreshCw size={17} />
          </button>
          <button className="button secondary" type="button" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </header>

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

      <div className="page stack">
        {isSupervisor ? (
          <>
            <ScreenMonitorPanel
              canvasRef={monitorCanvasRef}
              employees={onlineMonitorIds}
              isMonitoring={isMonitoring}
              selectedEmployeeId={selectedMonitorId}
              status={monitorStatus}
              onChangeEmployee={setSelectedMonitorId}
              onStart={startScreenMonitor}
              onStop={stopScreenMonitor}
            />
            {adminOverviewPanel}
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
          </>
        ) : (
          <>
        {!isAdmin && liveExecutionPanel}

        {!isAdmin ? (
          <div className="dashboard-grid calendar-grid">
            <MonthlyActivityCalendar
              activeShift={activeShift}
              dailyPerformance={dailyPerformance}
              events={events}
              leaveRequests={approvedLeaveRequests}
              schedules={schedules}
              selectedDay={selectedCalendarDay}
              onSelectDay={setSelectedCalendarDay}
            />

            <LeavePanel
              isAdmin={isAdmin}
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
          </div>
        ) : (
          <LeavePanel
            isAdmin={isAdmin}
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
        )}

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

        {isAdmin && (
          <ScreenMonitorPanel
            canvasRef={monitorCanvasRef}
            employees={onlineMonitorIds}
            isMonitoring={isMonitoring}
            selectedEmployeeId={selectedMonitorId}
            status={monitorStatus}
            onChangeEmployee={setSelectedMonitorId}
            onStart={startScreenMonitor}
            onStop={stopScreenMonitor}
          />
        )}

        {isAdmin && (
          <div className="dashboard-grid">
            <section className="panel scheduling-setup-panel">
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
                      <option value={4}>4 breaks</option>
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
                    {selectedTemplateBreaks.map((breakItem, index) => (
                      <div className="break-row" key={index}>
                        <div className="field">
                          <label htmlFor={`break-label-${index}`}>Name</label>
                          <input
                            id={`break-label-${index}`}
                            value={breakItem.label}
                            onChange={(event) => updateBreak(index, "label", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`break-type-${index}`}>Type</label>
                          <select
                            id={`break-type-${index}`}
                            value={breakItem.type}
                            onChange={(event) => updateBreak(index, "type", event.target.value)}
                          >
                            <option value="break">Break</option>
                            <option value="lunch">Lunch</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`break-mode-${index}`}>Rule</label>
                          <select
                            id={`break-mode-${index}`}
                            value={breakItem.mode}
                            onChange={(event) => updateBreak(index, "mode", event.target.value)}
                          >
                            <option value="static">Static</option>
                            <option value="dynamic">Dynamic</option>
                          </select>
                        </div>
                        {breakItem.mode === "static" ? (
                          <>
                            <div className="field">
                              <label htmlFor={`break-start-${index}`}>From</label>
                              <input
                                id={`break-start-${index}`}
                                type="time"
                                value={breakItem.startTime}
                                onChange={(event) => updateBreak(index, "startTime", event.target.value)}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`break-end-${index}`}>To</label>
                              <input
                                id={`break-end-${index}`}
                                type="time"
                                value={breakItem.endTime}
                                onChange={(event) => updateBreak(index, "endTime", event.target.value)}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="field break-duration-field">
                            <label htmlFor={`break-duration-${index}`}>Duration</label>
                            <select
                              id={`break-duration-${index}`}
                              value={breakItem.durationMinutes}
                              onChange={(event) =>
                                updateBreak(index, "durationMinutes", Number(event.target.value))
                              }
                            >
                              {dynamicBreakDurations.map((minutes) => (
                                <option key={minutes} value={minutes}>
                                  {minutes} min
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="break-duration-pill">
                          {breakItem.mode === "dynamic"
                            ? `${breakItem.durationMinutes}m flex`
                            : `${breakItem.durationMinutes || minutesBetweenTimes(breakItem.startTime, breakItem.endTime)}m`}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="template-activity-editor">
                    <div className="template-activity-heading">
                      <strong>Optional activities</strong>
                      <span>{selectedTemplateActivities.length} selected</span>
                    </div>
                    {templateForm.activities.map((activity) => (
                      <div className="template-activity-row" key={activity.type}>
                        <label className="template-activity-toggle" htmlFor={`activity-${activity.type}`}>
                          <input
                            checked={activity.enabled}
                            id={`activity-${activity.type}`}
                            type="checkbox"
                            onChange={(event) =>
                              updateTemplateActivity(activity.type, "enabled", event.target.checked)
                            }
                          />
                          <span>{activity.label}</span>
                        </label>
                        <div className="field">
                          <label htmlFor={`activity-start-${activity.type}`}>From</label>
                          <input
                            disabled={!activity.enabled}
                            id={`activity-start-${activity.type}`}
                            type="time"
                            value={activity.startTime}
                            onChange={(event) =>
                              updateTemplateActivity(activity.type, "startTime", event.target.value)
                            }
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`activity-end-${activity.type}`}>To</label>
                          <input
                            disabled={!activity.enabled}
                            id={`activity-end-${activity.type}`}
                            type="time"
                            value={activity.endTime}
                            onChange={(event) =>
                              updateTemplateActivity(activity.type, "endTime", event.target.value)
                            }
                          />
                        </div>
                        <div className="break-duration-pill">
                          {activity.durationMinutes || minutesBetweenTimes(activity.startTime, activity.endTime)}m
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="button" disabled={loading} type="submit">
                    <Plus size={17} />
                    Create template
                  </button>
                </form>

                <div className="record-list">
                  {templates.length ? (
                    templates.map((template) => {
                      const assignedCount = schedules.filter((schedule) => {
                        const templateId =
                          typeof schedule.shiftTemplateId === "string"
                            ? schedule.shiftTemplateId
                            : schedule.shiftTemplateId._id;
                        return templateId === template._id;
                      }).length;

                      return (
                        <article className="record" key={template._id}>
                          <div>
                            <strong>{template.name}</strong>
                            <p>
                              {formatTimeRange(template.startTime, template.endTime)} ·{" "}
                              {template.breaks.length} break{template.breaks.length === 1 ? "" : "s"} -{" "}
                              {template.activities?.length || 0} optional activit
                              {(template.activities?.length || 0) === 1 ? "y" : "ies"}
                            </p>
                          </div>
                          <button
                            className="button danger schedule-delete-button"
                            disabled={loading || assignedCount > 0}
                            title={
                              assignedCount
                                ? "Delete assigned schedules before deleting this template"
                                : "Delete template"
                            }
                            type="button"
                            onClick={() => deleteTemplate(template)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <p className="muted">No templates created yet.</p>
                  )}
                </div>

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
                  <WorkDateMultiPicker
                    leaveRequests={approvedLeaveRequests}
                    month={assignmentMonth}
                    selectedDates={scheduleForm.workDates}
                    onChangeMonth={setAssignmentMonth}
                    onToggleDate={toggleScheduleDate}
                  />
                  <button className="button secondary" disabled={loading} type="submit">
                    <CalendarDays size={17} />
                    Assign {scheduleForm.workDates.length || ""} schedule
                    {scheduleForm.workDates.length === 1 ? "" : "s"}
                  </button>
                </form>

                <h2>Delete Schedules</h2>
                <form className="form-grid" onSubmit={deleteSchedules}>
                  <div className="field">
                    <label htmlFor="delete-assignee">Team member</label>
                    <select
                      id="delete-assignee"
                      value={scheduleDeleteForm.userId}
                      onChange={(event) =>
                        setScheduleDeleteForm((current) => ({
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
                    <label htmlFor="delete-start-date">From date</label>
                    <input
                      id="delete-start-date"
                      type="date"
                      value={scheduleDeleteForm.startDate}
                      onChange={(event) =>
                        setScheduleDeleteForm((current) => ({
                          ...current,
                          startDate: event.target.value,
                          endDate:
                            current.endDate < event.target.value ? event.target.value : current.endDate,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="delete-end-date">To date</label>
                    <input
                      id="delete-end-date"
                      type="date"
                      value={scheduleDeleteForm.endDate}
                      onChange={(event) =>
                        setScheduleDeleteForm((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <button className="button danger" disabled={loading} type="submit">
                    <Trash2 size={17} />
                    Delete schedules
                  </button>
                </form>
              </div>
            </section>

            <ShiftEventsPanel events={events} />
          </div>
        )}

        {isAdmin && (
          <>
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
            />
          </>
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
                          ?.map(
                            (item) =>
                              `${item.label}: ${
                                (item.mode || "static") === "dynamic"
                                  ? `Dynamic (${item.durationMinutes}m)`
                                  : `${formatTimeRange(item.startTime, item.endTime)} (${item.durationMinutes}m)`
                              }`
                          )
                          .join(" | ") || "No breaks"}
                      </span>
                      <span className="muted">
                        {template.activities?.length
                          ? template.activities
                              .map(
                                (item) =>
                                  `${item.label}: ${formatTimeRange(item.startTime, item.endTime)} (${item.durationMinutes}m)`
                              )
                              .join(" | ")
                          : "No optional activities"}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="muted">No templates created yet.</p>
                )}
              </div>
            </section>

            <AssignedSchedules schedules={schedules} users={users} onDeleteSchedule={deleteSingleSchedule} />
          </div>
        )}

        {!isAdmin && dailyPerformancePanel}

        {isAdmin && (
          <div className="admin-final-stack">
            {liveExecutionPanel}
            <div className="dashboard-grid">
              {adminOverviewPanel}
              {dailyPerformancePanel}
            </div>
          </div>
        )}
          </>
        )}
      </div>
      </main>
    </>
  );
}

function DesktopOnlyNotice() {
  return (
    <main className="desktop-only-notice">
      <section className="auth-panel">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1>ShiftSync</h1>
            <p>Desktop access required</p>
          </div>
        </div>
        <p className="muted">
          This workforce management system is restricted to laptop and desktop screens. Please open
          it on a computer to continue.
        </p>
      </section>
    </main>
  );
}

function ScreenMonitorPanel({
  canvasRef,
  employees,
  isMonitoring,
  onChangeEmployee,
  onStart,
  onStop,
  selectedEmployeeId,
  status,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
  employees: string[];
  isMonitoring: boolean;
  selectedEmployeeId: string;
  status: string;
  onChangeEmployee: (employeeId: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const canMonitor = Boolean(selectedEmployeeId && employees.includes(selectedEmployeeId));
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === sectionRef.current);
    }

    function closeFallbackFullscreen(event: KeyboardEvent) {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("keydown", closeFallbackFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("keydown", closeFallbackFullscreen);
    };
  }, []);

  async function toggleFullscreen() {
    const section = sectionRef.current;
    if (!section) return;

    try {
      if (document.fullscreenElement === section) {
        await document.exitFullscreen();
        return;
      }

      if (section.requestFullscreen) {
        await section.requestFullscreen();
        return;
      }
    } catch {
      setIsFullscreen((current) => !current);
      return;
    }

    setIsFullscreen((current) => !current);
  }

  return (
    <section ref={sectionRef} className={`panel screen-monitor-panel ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="panel-header">
        <div className="panel-title">
          <Monitor size={20} />
          <div>
            <h2>Screen Monitor</h2>
            <p className="panel-subtitle">On-demand live view for online desktop emails</p>
          </div>
        </div>
        <div className="screen-monitor-header-actions">
          <span className={`pill ${isMonitoring ? "" : status === "Connecting" ? "warn" : "danger"}`}>
            {status}
          </span>
          <button
            aria-label={isFullscreen ? "Exit fullscreen monitor" : "Open fullscreen monitor"}
            className="icon-button secondary"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            type="button"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>

      <div className="screen-monitor-grid">
        <div className="screen-monitor-controls">
          <div className="field">
            <label htmlFor="screen-monitor-employee">Online email</label>
            <select
              id="screen-monitor-employee"
              value={selectedEmployeeId}
              onChange={(event) => onChangeEmployee(event.target.value)}
              disabled={isMonitoring || employees.length === 0}
            >
              {employees.length ? (
                employees.map((employeeId) => (
                  <option key={employeeId} value={employeeId}>
                    {employeeId}
                  </option>
                ))
              ) : (
                <option value="">No emails online</option>
              )}
            </select>
          </div>

          <button className="button" disabled={!canMonitor || isMonitoring} type="button" onClick={onStart}>
            <Monitor size={17} />
            Monitor Screen
          </button>
        </div>

        <div className={`screen-frame ${isMonitoring ? "live" : ""}`}>
          <canvas ref={canvasRef} aria-label="Live employee screen feed" />
          {!isMonitoring && <span className="screen-placeholder">No active stream</span>}
          {isMonitoring && (
            <button
              aria-label="Close stream"
              className="screen-close-button"
              type="button"
              onClick={onStop}
            >
              <X size={17} />
              Close Stream
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkDateMultiPicker({
  leaveRequests,
  month,
  onChangeMonth,
  onToggleDate,
  selectedDates,
}: {
  leaveRequests: LeaveRequest[];
  month: string;
  selectedDates: string[];
  onChangeMonth: (month: string) => void;
  onToggleDate: (date: string) => void;
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0, 12));
  const leadingDays = monthStart.getDay();
  const totalCells = Math.ceil((leadingDays + monthEnd.getDate()) / 7) * 7;
  const selectedSet = new Set(selectedDates);

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    if (dayNumber < 1 || dayNumber > monthEnd.getDate()) return null;
    return new Date(Date.UTC(year, monthNumber - 1, dayNumber, 12));
  });

  function shiftMonth(offset: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1, 12));
    onChangeMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="field full work-date-picker">
      <div className="work-date-picker-head">
        <label>Work dates</label>
        <div className="picker-month-controls">
          <button aria-label="Previous month" type="button" onClick={() => shiftMonth(-1)}>
            Previous
          </button>
          <strong>
            {monthStart.toLocaleDateString(undefined, {
              month: "long",
              timeZone: BUSINESS_TIME_ZONE,
              year: "numeric",
            })}
          </strong>
          <button aria-label="Next month" type="button" onClick={() => shiftMonth(1)}>
            Next
          </button>
        </div>
      </div>
      <div className="calendar-weekdays compact">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="work-date-grid">
        {cells.map((date, index) => {
          if (!date) return <div className="work-date-cell empty" key={index} />;

          const key = toDateKey(date);
          const isSelected = selectedSet.has(key);
          const isLeave = leaveRequests.some((request) => isDateInLeave(date, request));

          return (
            <button
              className={`work-date-cell ${isSelected ? "selected" : ""} ${isLeave ? "leave" : ""}`}
              key={key}
              type="button"
              onClick={() => onToggleDate(key)}
            >
              <strong>{date.getUTCDate()}</strong>
              {isLeave && <span>Leave</span>}
            </button>
          );
        })}
      </div>
      <div className="selected-date-chips">
        {selectedDates.length ? (
          selectedDates.map((date) => (
            <button key={date} type="button" onClick={() => onToggleDate(date)}>
              {formatDate(date)}
              <X size={13} />
            </button>
          ))
        ) : (
          <span>No dates selected</span>
        )}
      </div>
    </div>
  );
}

function MonthlyActivityCalendar({
  activeShift,
  dailyPerformance,
  events,
  leaveRequests,
  onSelectDay,
  schedules,
  selectedDay,
}: {
  activeShift: ActiveShiftResponse;
  dailyPerformance: DailyPerformance | null;
  events: ShiftEvent[];
  leaveRequests: LeaveRequest[];
  schedules: Schedule[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  const londonToday = londonDateParts();
  const today = new Date(Date.UTC(londonToday.year, londonToday.month - 1, londonToday.day, 12));
  const monthStart = new Date(Date.UTC(londonToday.year, londonToday.month - 1, 1, 12));
  const monthEnd = new Date(Date.UTC(londonToday.year, londonToday.month, 0, 12));
  const leadingDays = monthStart.getDay();
  const totalCells = Math.ceil((leadingDays + monthEnd.getDate()) / 7) * 7;
  const scheduleKeys = new Set(schedules.map((schedule) => toDateKey(schedule.workDate)));
  const todayKey = toDateKey(today);
  const selectedSchedule = schedules.find((schedule) => toDateKey(schedule.workDate) === selectedDay);
  const selectedTemplate =
    selectedSchedule && typeof selectedSchedule.shiftTemplateId !== "string"
      ? selectedSchedule.shiftTemplateId
      : null;
  const assignedBreaks = selectedTemplate?.breaks || [];
  const assignedActivities = selectedTemplate?.activities || [];
  const selectedLeave = leaveRequests.find((request) =>
    selectedDay ? isDateInLeave(new Date(`${selectedDay}T00:00:00`), request) : false
  );

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    if (dayNumber < 1 || dayNumber > monthEnd.getDate()) return null;
    return new Date(Date.UTC(londonToday.year, londonToday.month - 1, dayNumber, 12));
  });

  return (
    <section className="panel calendar-panel">
      <div className="panel-header">
        <div className="panel-title">
          <CalendarDays size={20} />
          <div>
            <h2>Monthly Activity Calendar</h2>
            <p className="panel-subtitle">
              {today.toLocaleDateString(undefined, {
                month: "long",
                timeZone: BUSINESS_TIME_ZONE,
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <span className="pill">{dailyPerformance?.overallScore ?? 100}% today</span>
      </div>

      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-month">
        {cells.map((date, index) => {
          if (!date) return <div className="calendar-day empty" key={index} />;

          const key = toDateKey(date);
          const isToday = key === todayKey;
          const isScheduled = scheduleKeys.has(key);
          const leave = leaveRequests.find((request) => isDateInLeave(date, request));
          const isSelected = selectedDay === key;

          return (
            <button
              className={`calendar-day ${isScheduled ? "scheduled" : ""} ${
                leave ? "leave-day" : ""
              } ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
            >
              <strong>{date.getDate()}</strong>
              {isScheduled && !leave && <span>Scheduled</span>}
              {isToday && !leave && <i>{dailyPerformance?.overallScore ?? 100}%</i>}
            </button>
          );
        })}
      </div>

      <div className="day-detail">
        <div className="record-row">
          <strong>{selectedDay ? formatDate(selectedDay) : "Select a date"}</strong>
          <span className={`pill ${selectedLeave ? "" : selectedSchedule ? "" : "warn"}`}>
            {selectedLeave ? "Leave / no shift" : selectedSchedule ? "Scheduled" : "Blank day"}
          </span>
        </div>
        <div className="day-detail-grid">
          <span>Shift</span>
          <strong>
            {selectedLeave
              ? "Approved leave"
              : selectedTemplate
                ? `${formatTimeRange(selectedTemplate.startTime, selectedTemplate.endTime)}`
                : selectedSchedule
                  ? "Assigned shift"
                : "No work expected"}
          </strong>
          <span>Logged activities</span>
          <strong>{selectedDay === todayKey ? events.length : 0}</strong>
          <span>Active hours</span>
          <strong>
            {selectedDay === todayKey && activeShift
              ? `${Math.round((activeShift.shift.totalWorkedMinutes || minutesBetween(activeShift.shift.clockInTime)) / 60)}h`
              : "-"}
          </strong>
          <span>Assigned breaks</span>
          <div className="assigned-breaks">
            {selectedLeave ? (
              <strong>No breaks on approved leave</strong>
            ) : assignedBreaks.length ? (
              assignedBreaks.map((breakItem, index) => (
                <div className="assigned-break" key={`${breakItem.label}-${index}`}>
                  <strong>{breakItem.label}</strong>
                  <span>
                    {(breakItem.type || "break") === "lunch" ? "Lunch" : "Break"} -{" "}
                    {(breakItem.mode || "static") === "dynamic"
                      ? `Dynamic - ${breakItem.durationMinutes}m anytime during shift`
                      : `${formatTimeRange(breakItem.startTime, breakItem.endTime)} - ${
                          breakItem.durationMinutes || minutesBetweenTimes(breakItem.startTime, breakItem.endTime)
                        }m`}
                  </span>
                </div>
              ))
            ) : (
              <strong>No assigned breaks</strong>
            )}
          </div>
          <span>Optional activities</span>
          <div className="assigned-breaks">
            {selectedLeave ? (
              <strong>No activities on approved leave</strong>
            ) : assignedActivities.length ? (
              assignedActivities.map((activity, index) => (
                <div className="assigned-break" key={`${activity.type}-${index}`}>
                  <strong>{activity.label}</strong>
                  <span>
                    {formatTimeRange(activity.startTime, activity.endTime)} -{" "}
                    {activity.durationMinutes || minutesBetweenTimes(activity.startTime, activity.endTime)}m
                  </span>
                </div>
              ))
            ) : (
              <strong>No optional activities</strong>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LeavePanel({
  isAdmin,
  leaveForm,
  leaveRequests,
  loading,
  onChangeLeaveForm,
  onChangeReviewComment,
  onReview,
  onSubmitLeave,
  reviewComments,
  users,
}: {
  isAdmin: boolean;
  leaveForm: {
    leaveType: LeaveRequest["leaveType"];
    startDate: string;
    endDate: string;
    reason: string;
  };
  leaveRequests: LeaveRequest[];
  loading: boolean;
  reviewComments: Record<string, string>;
  users: User[];
  onChangeLeaveForm: (next: typeof leaveForm | ((current: typeof leaveForm) => typeof leaveForm)) => void;
  onChangeReviewComment: (
    next: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)
  ) => void;
  onReview: (requestId: string, status: "approved" | "rejected") => void;
  onSubmitLeave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const pending = leaveRequests.filter((request) => request.status === "pending");

  return (
    <section className="panel leave-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ClipboardList size={20} />
          <div>
            <h2>{isAdmin ? "Leave Management" : "Leave Requests"}</h2>
            <p className="panel-subtitle">
              {isAdmin ? `${pending.length} pending approvals` : "Request and track time away"}
            </p>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <form className="leave-form" onSubmit={onSubmitLeave}>
          <div className="field">
            <label htmlFor="leave-type">Leave type</label>
            <select
              id="leave-type"
              value={leaveForm.leaveType}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({
                  ...current,
                  leaveType: event.target.value as LeaveRequest["leaveType"],
                }))
              }
            >
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="unpaid">Unpaid</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="leave-start">Start date</label>
            <input
              id="leave-start"
              type="date"
              value={leaveForm.startDate}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({ ...current, startDate: event.target.value }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="leave-end">End date</label>
            <input
              id="leave-end"
              type="date"
              value={leaveForm.endDate}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({ ...current, endDate: event.target.value }))
              }
              required
            />
          </div>
          <div className="field full">
            <label htmlFor="leave-reason">Reason</label>
            <input
              id="leave-reason"
              value={leaveForm.reason}
              onChange={(event) =>
                onChangeLeaveForm((current) => ({ ...current, reason: event.target.value }))
              }
              required
            />
          </div>
          <button className="button" disabled={loading} type="submit">
            <Send size={17} />
            Submit request
          </button>
        </form>
      )}

      <div className="record-list leave-list">
        {leaveRequests.length ? (
          leaveRequests.map((request) => {
            const member = users.find((item) => item._id === request.userId);
            return (
              <article className="record" key={request._id}>
                <div className="record-row">
                  <span className="record-title">
                    {member ? member.name : request.leaveType.replace("_", " ")}
                  </span>
                  <span
                    className={`pill ${
                      request.status === "rejected"
                        ? "danger"
                        : request.status === "pending"
                          ? "warn"
                          : ""
                    }`}
                  >
                    {request.status}
                  </span>
                </div>
                <span className="muted">
                  {formatDate(request.startDate)} to {formatDate(request.endDate)}
                </span>
                <span>{request.reason}</span>
                {request.managerComment && (
                  <span className="muted">Manager: {request.managerComment}</span>
                )}

                {isAdmin && request.status === "pending" && (
                  <div className="review-box">
                    <input
                      aria-label="Manager comment"
                      placeholder="Manager comment"
                      value={reviewComments[request._id] || ""}
                      onChange={(event) =>
                        onChangeReviewComment((current) => ({
                          ...current,
                          [request._id]: event.target.value,
                        }))
                      }
                    />
                    <div className="review-actions">
                      <button
                        className="button"
                        disabled={loading}
                        type="button"
                        onClick={() => onReview(request._id, "approved")}
                      >
                        <CheckCircle2 size={17} />
                        Approve
                      </button>
                      <button
                        className="button danger"
                        disabled={loading}
                        type="button"
                        onClick={() => onReview(request._id, "rejected")}
                      >
                        <XCircle size={17} />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p className="muted">No leave requests yet.</p>
        )}
      </div>
    </section>
  );
}

function ChatPanel({
  conversations,
  currentUser,
  draft,
  loading,
  messages,
  onChangeDraft,
  onChangeRecipient,
  onRefresh,
  onSelectConversation,
  onSendMessage,
  onStartConversation,
  recipients,
  selectedConversationId,
  selectedRecipientId,
}: {
  conversations: ChatConversation[];
  currentUser: User;
  draft: string;
  loading: boolean;
  messages: ChatMessage[];
  recipients: User[];
  selectedConversationId: string | null;
  selectedRecipientId: string;
  onChangeDraft: (value: string) => void;
  onChangeRecipient: (value: string) => void;
  onRefresh: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onStartConversation: () => void;
}) {
  const activeConversation =
    conversations.find((conversation) => conversation._id === selectedConversationId) || null;
  const activeRecipient =
    activeConversation?.otherParticipant ||
    recipients.find((recipient) => recipient._id === selectedRecipientId);

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div className="panel-title">
          <MessageSquare size={20} />
          <div>
            <h2>Team Chat</h2>
            <p className="panel-subtitle">
              Message anyone on the workforce dashboard
            </p>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh chat">
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-compose">
            <div className="field">
              <label htmlFor="chat-recipient">Start or open chat</label>
              <select
                id="chat-recipient"
                value={selectedRecipientId}
                onChange={(event) => onChangeRecipient(event.target.value)}
                disabled={!recipients.length}
              >
                {recipients.length ? (
                  recipients.map((recipient) => (
                    <option key={recipient._id} value={recipient._id}>
                      {recipient.name} ({formatRole(recipient.role)})
                    </option>
                  ))
                ) : (
                  <option value="">No recipients available</option>
                )}
              </select>
            </div>
            <button
              className="button secondary"
              disabled={loading || !selectedRecipientId}
              type="button"
              onClick={onStartConversation}
            >
              <MessageSquare size={17} />
              Open
            </button>
          </div>

          <div className="chat-conversations">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  className={`conversation-button ${
                    conversation._id === selectedConversationId ? "active" : ""
                  }`}
                  key={conversation._id}
                  type="button"
                  onClick={() => onSelectConversation(conversation._id)}
                >
                  <span>
                    <strong>{conversation.otherParticipant?.name || "Conversation"}</strong>
                    <small>{conversation.lastMessage || "No messages yet"}</small>
                  </span>
                  {conversation.unreadCount > 0 && (
                    <i aria-label={`${conversation.unreadCount} unread messages`}>
                      {conversation.unreadCount}
                    </i>
                  )}
                </button>
              ))
            ) : (
              <p className="muted">No conversations yet.</p>
            )}
          </div>
        </aside>

        <div className="chat-thread">
          <div className="chat-thread-head">
            <div>
              <strong>{activeRecipient?.name || "Select a conversation"}</strong>
              <span>{activeRecipient?.email || "Choose who you want to message."}</span>
            </div>
            {activeRecipient && <span className="pill">{formatRole(activeRecipient.role)}</span>}
          </div>

          <div className="message-list">
            {messages.length ? (
              messages.map((message) => {
                const mine = message.senderId._id === currentUser._id;
                return (
                  <article className={`message-bubble ${mine ? "mine" : ""}`} key={message._id}>
                    <strong>{mine ? "You" : message.senderId.name}</strong>
                    <p>{message.body}</p>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </article>
                );
              })
            ) : (
              <p className="muted">No messages in this conversation yet.</p>
            )}
          </div>

          <form className="chat-input" onSubmit={onSendMessage}>
            <input
              aria-label="Message"
              maxLength={2000}
              placeholder={activeRecipient ? `Message ${activeRecipient.name}` : "Select a recipient"}
              value={draft}
              onChange={(event) => onChangeDraft(event.target.value)}
              disabled={!activeRecipient}
            />
            <button className="button" disabled={loading || !activeRecipient || !draft.trim()} type="submit">
              <Send size={17} />
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function HiringManagerAgentAllocationPanel({
  loading,
  onAssignAgents,
  users,
}: {
  loading: boolean;
  users: User[];
  onAssignAgents: (user: User, agentIds: string[]) => void;
}) {
  const managers = useMemo(() => users.filter((member) => member.role === "supervisor"), [users]);
  const agents = useMemo(() => users.filter((member) => member.role === "agent"), [users]);
  const [managerId, setManagerId] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const manager = managers.find((item) => item._id === managerId) || null;
  const assignedKey = (manager?.assignedAgentIds || []).map(String).join("|");

  useEffect(() => {
    setManagerId((current) =>
      managers.some((item) => item._id === current) ? current : managers[0]?._id || ""
    );
  }, [managers]);

  useEffect(() => {
    setSelectedAgentIds((manager?.assignedAgentIds || []).map(String));
  }, [manager?._id, assignedKey]);

  function toggleAgent(agentId: string, checked: boolean) {
    setSelectedAgentIds((current) =>
      checked ? [...new Set([...current, agentId])] : current.filter((id) => id !== agentId)
    );
  }

  return (
    <section className="panel manager-allocation-panel">
      <div className="panel-header">
        <div className="panel-title">
          <UserRound size={20} />
          <div>
            <h2>Hiring Manager Agent Allocation</h2>
            <p className="panel-subtitle">Assigned agents appear in hiring manager chat and execution overview</p>
          </div>
        </div>
        <button
          className="button"
          disabled={loading || !manager}
          type="button"
          onClick={() => manager && onAssignAgents(manager, selectedAgentIds)}
        >
          <CheckCircle2 size={17} />
          Save allocation
        </button>
      </div>

      <div className="manager-allocation-grid">
        <div className="field">
          <label htmlFor="allocation-manager">Hiring manager</label>
          <select
            id="allocation-manager"
            disabled={loading || !managers.length}
            value={managerId}
            onChange={(event) => setManagerId(event.target.value)}
          >
            {managers.length ? (
              managers.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} ({item.email})
                </option>
              ))
            ) : (
              <option value="">No hiring managers</option>
            )}
          </select>
          <span className="muted">
            {manager ? `${selectedAgentIds.length} of ${agents.length} agents assigned` : "Select a hiring manager"}
          </span>
        </div>

        <div className="agent-allocation-list">
          {agents.length ? (
            agents.map((agent) => (
              <label className="agent-check" key={agent._id}>
                <input
                  type="checkbox"
                  checked={selectedAgentIds.includes(agent._id)}
                  disabled={loading || !manager}
                  onChange={(event) => toggleAgent(agent._id, event.target.checked)}
                />
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.email}</small>
                </span>
              </label>
            ))
          ) : (
            <p className="muted">No agents available to assign.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function UserAccountsPanel({
  currentUserId,
  loading,
  onApproveUser,
  onDeleteUser,
  users,
}: {
  currentUserId: string;
  loading: boolean;
  onApproveUser: (user: User) => void;
  users: User[];
  onDeleteUser: (user: User) => void;
}) {

  return (
    <section className="panel user-accounts-panel">
      <div className="panel-header">
        <div className="panel-title">
          <UserRound size={20} />
          <div>
            <h2>User Accounts</h2>
            <p className="panel-subtitle">Manage registered dashboard access</p>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>MFA</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((member) => {
              const isCurrentUser = member._id === currentUserId;
              const canDelete = !isCurrentUser && member.role !== "admin";
              const accountStatus = member.accountStatus || "approved";
              const canApprove = member.role === "supervisor" && accountStatus === "pending";

              return (
                <tr key={member._id}>
                  <td>
                    <strong>{member.name}</strong>
                    {isCurrentUser && <span>Signed-in account</span>}
                  </td>
                  <td>{member.email}</td>
                  <td>{formatRole(member.role)}</td>
                  <td>
                    <span className={`pill ${accountStatus === "pending" ? "warn" : ""}`}>
                      {accountStatus}
                    </span>
                  </td>
                  <td>{member.mfaEnabled ? "Enabled" : "Not enabled"}</td>
                  <td>
                    <div className="review-actions account-actions">
                      {canApprove && (
                        <button
                          className="button secondary"
                          disabled={loading}
                          type="button"
                          onClick={() => onApproveUser(member)}
                        >
                          <BadgeCheck size={16} />
                          Approve
                        </button>
                      )}
                      <button
                        className="button danger account-delete-button"
                        disabled={loading || !canDelete}
                        type="button"
                        onClick={() => onDeleteUser(member)}
                      >
                        <Trash2 size={16} />
                        {member.role === "admin" ? "Protected" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
        <ScoreBar
          label="Activity adherence"
          value={performance.breakdown.activityAdherenceScore ?? performance.breakdown.breakScore}
        />
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
  canDownload = false,
  loading,
  overview,
  onRunMaintenance,
}: {
  canDownload?: boolean;
  loading: boolean;
  overview: AdminOverview;
  onRunMaintenance?: () => void;
}) {
  function downloadOverviewExcel() {
    const rows = overview.users.map((item) => {
      const adherence =
        item.performance.adherenceScore ??
        item.performance.breakdown.activityAdherenceScore ??
        item.performance.breakdown.breakScore;

      return `
        <tr>
          <td>${escapeExcelCell(item.user.name)}</td>
          <td>${escapeExcelCell(item.user.email)}</td>
          <td>${escapeExcelCell(formatRole(item.user.role))}</td>
          <td>${escapeExcelCell(item.performance.status)}</td>
          <td>${escapeExcelCell(item.performance.overallScore)}%</td>
          <td>${escapeExcelCell(adherence)}%</td>
          <td>${escapeExcelCell(item.performance.workedMinutes)}m</td>
          <td>${escapeExcelCell(item.performance.lateMinutes)}m</td>
          <td>${escapeExcelCell(item.performance.overtimeMinutes)}m</td>
        </tr>`;
    });
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table>
            <thead>
              <tr>
                <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Overall</th>
                <th>Adherence</th><th>Worked</th><th>Late</th><th>Overtime</th>
              </tr>
            </thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </body>
      </html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `admin-execution-overview-${String(overview.date).slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

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
        <div className="review-actions">
          {canDownload && (
            <button className="button secondary" type="button" onClick={downloadOverviewExcel}>
              <Download size={17} />
              Download Excel
            </button>
          )}
          {onRunMaintenance && (
            <button className="button secondary" disabled={loading} type="button" onClick={onRunMaintenance}>
              <RefreshCw size={17} />
              Run maintenance
            </button>
          )}
        </div>
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
          <span>Avg adherence</span>
          <strong>{overview.totals.averageAdherence}%</strong>
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
              <th>Role</th>
              <th>Status</th>
              <th>Overall</th>
              <th>Adherence</th>
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
                <td>{formatRole(item.user.role)}</td>
                <td>{item.performance.status}</td>
                <td>{item.performance.overallScore}%</td>
                <td>
                  {item.performance.adherenceScore ??
                    item.performance.breakdown.activityAdherenceScore ??
                    item.performance.breakdown.breakScore}
                  %
                </td>
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
  onDeleteSchedule,
  schedules,
  users,
}: {
  onDeleteSchedule?: (schedule: Schedule) => void;
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
                {template?.activities?.length ? (
                  <span className="muted">
                    {template.activities
                      .map((activity) => `${activity.label}: ${formatTimeRange(activity.startTime, activity.endTime)}`)
                      .join(" | ")}
                  </span>
                ) : null}
                {template?.breaks?.length ? (
                  <span className="muted">
                    {template.breaks
                      .map((breakItem) =>
                        `${breakItem.label}: ${
                          (breakItem.mode || "static") === "dynamic"
                            ? `Dynamic ${breakItem.durationMinutes}m`
                            : `${formatTimeRange(breakItem.startTime, breakItem.endTime)}`
                        }`
                      )
                      .join(" | ")}
                  </span>
                ) : null}
                {onDeleteSchedule && (
                  <button
                    className="button danger schedule-delete-button"
                    type="button"
                    onClick={() => onDeleteSchedule(schedule)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}
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
