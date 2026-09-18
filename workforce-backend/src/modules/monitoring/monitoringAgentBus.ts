// One-way notification channel from shift-lifecycle code to whatever realtime
// transport currently hosts the employee's desktop agent. Keeps
// monitoring.service free of imports from realtime/screenMonitor (which
// itself imports monitoring.service, so a direct link would be circular).
type AgentNotifier = (userId: string, payload: Record<string, unknown>) => void;

let notifier: AgentNotifier | null = null;

export function registerAgentNotifier(fn: AgentNotifier) {
  notifier = fn;
}

export function notifyMonitoringAgent(userId: string, payload: Record<string, unknown>) {
  if (!notifier || !userId) return;

  try {
    notifier(String(userId), payload);
  } catch {
    // Notification is best-effort; an offline agent simply misses it and
    // re-syncs on its next reconnect.
  }
}
