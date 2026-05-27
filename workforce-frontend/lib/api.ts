const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const SCREEN_MONITOR_WS_URL = process.env.NEXT_PUBLIC_SCREEN_MONITOR_WS_URL;
const BUSINESS_TIME_ZONE = "Europe/London";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  body?: unknown;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.violation || "Request failed");
  }

  return data as T;
}

export function formatDateTime(value?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

export function formatDate(value?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

export function getScreenMonitorWsUrl(path = "/screen-monitor") {
  if (SCREEN_MONITOR_WS_URL) return SCREEN_MONITOR_WS_URL;

  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path;
  url.search = "";
  return url.toString();
}
