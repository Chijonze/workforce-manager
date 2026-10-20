// One-way notification channel from shift-lifecycle code to whatever realtime
// transport currently hosts the employee's desktop agent. Keeps
// monitoring.service free of imports from realtime/screenMonitor (which
// itself imports monitoring.service, so a direct link would be circular).
type AgentNotifier = (userId: string, payload: Record<string, unknown>) => boolean;

let notifier: AgentNotifier | null = null;

export function registerAgentNotifier(fn: AgentNotifier) {
  notifier = fn;
}

// Returns true when at least one connected desktop agent received the message.
// Callers use that to record whether desktop monitoring actually took over.
export function notifyMonitoringAgent(userId: string, payload: Record<string, unknown>): boolean {
  if (!notifier || !userId) return false;

  try {
    return notifier(String(userId), payload) === true;
  } catch {
    // Notification is best-effort; an offline agent simply misses it and
    // re-syncs on its next reconnect.
    return false;
  }
}
