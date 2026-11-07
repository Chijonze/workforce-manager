import AiQuotaState from "../../models/AiQuotaState";

const DEFAULT_SCOPE = "ai";
// A throttle is almost always a concurrency burst, not an account-level cap, so
// the pause is short: long enough to let the provider drain, short enough that
// the retry sweep resumes without a manual restart.
const MIN_BLOCK_MS = 15_000;
const DEFAULT_RETRY_MS = 60_000;

const dayKey = (timeZone = process.env.BUSINESS_TIME_ZONE || "Africa/Lagos") => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

/**
 * Provider throttling responses carry the wait either in a Retry-After header or
 * inside the error body ("retry after 12 seconds"). Anything else gets a
 * conservative one-minute pause instead of a hard failure.
 */
export const parseRetryDelayMs = (body: string, retryAfterHeader?: string | null) => {
  const headerSeconds = Number(retryAfterHeader);
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) return headerSeconds * 1000;

  const seconds = body.match(/retry(?:\s+after)?\s*(?:in)?\s*(\d+(?:\.\d+)?)\s*(?:s\b|sec|second)/i);
  if (seconds) return Math.max(1000, Number(seconds[1]) * 1000);

  const millis = body.match(/retry(?:\s+after)?\s*(?:in)?\s*(\d+)\s*ms/i);
  if (millis) return Math.max(500, Number(millis[1]));

  return DEFAULT_RETRY_MS;
};

export const isThrottled = (status: number, body: string) =>
  status === 429 ||
  /rate.?limit|too many requests|concurrency|overloaded/i.test(body);

export const noteProviderThrottle = async (options: {
  retryAfterMs: number;
  model: string;
  reason: string;
  scope?: string;
}) => {
  const until = new Date(Date.now() + Math.max(MIN_BLOCK_MS, options.retryAfterMs || 0));
  await AiQuotaState.findOneAndUpdate(
    { scope: options.scope || DEFAULT_SCOPE },
    {
      scope: options.scope || DEFAULT_SCOPE,
      aiModel: options.model,
      blockedUntil: until,
      reason: options.reason.slice(0, 500),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).catch((error) => {
    // Never let bookkeeping break a request path.
    console.error("Could not persist AI throttle state", error);
  });
  console.warn(
    `AI provider throttled (${options.model}); pausing calls until ${until.toISOString()} — ${options.reason.slice(
      0,
      160
    )}`
  );
  return until;
};

export const getQuotaState = () => AiQuotaState.findOne({ scope: DEFAULT_SCOPE }).lean();

export const isQuotaBlocked = async () => {
  const state = await getQuotaState().catch(() => null);
  if (!state?.blockedUntil) return { blocked: false as const };
  const until = new Date(state.blockedUntil);
  if (until.getTime() <= Date.now()) {
    // Expired: clear lazily so the next call is clean.
    await AiQuotaState.updateOne(
      { scope: DEFAULT_SCOPE, blockedUntil: { $lte: new Date() } },
      { $set: { blockedUntil: null } }
    ).catch(() => undefined);
    return { blocked: false as const };
  }
  return {
    blocked: true as const,
    until,
    model: state.aiModel || "",
    reason: state.reason || "",
  };
};

/** Daily narration-attempt budget, so a retry sweep cannot run away. */
export const consumeDailyAttempt = async (limit: number) => {
  const key = dayKey();
  const state = await AiQuotaState.findOne({ scope: DEFAULT_SCOPE });

  if (!state) {
    await AiQuotaState.create({
      scope: DEFAULT_SCOPE,
      attemptsDayKey: key,
      attemptsToday: 1,
    });
    return { allowed: true, used: 1, limit };
  }

  const used = state.attemptsDayKey === key ? state.attemptsToday : 0;
  if (used >= limit) return { allowed: false, used, limit };

  state.attemptsDayKey = key;
  state.attemptsToday = used + 1;
  await state.save();
  return { allowed: true, used: used + 1, limit };
};

/**
 * Diagnostic view for operators. Deliberately omits the model name: this payload
 * is reachable from the dashboard and the vendor must stay internal.
 */
export const quotaSnapshot = async () => {
  const state = await getQuotaState();
  const blocked = await isQuotaBlocked();
  const key = dayKey();
  return {
    blocked: blocked.blocked,
    pausedUntil: blocked.blocked ? blocked.until?.toISOString() : null,
    reason: blocked.blocked ? blocked.reason : null,
    attemptsToday: state?.attemptsDayKey === key ? state.attemptsToday : 0,
    dayKey: key,
    updatedAt: state?.updatedAt || null,
  };
};
