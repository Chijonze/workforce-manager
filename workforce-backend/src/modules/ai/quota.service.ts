import AiQuotaState from "../../models/AiQuotaState";

const DEFAULT_SCOPE = "gemini";
const MIN_BLOCK_MS = 30_000;

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
 * Google reports the reset instant inside the 429 message, e.g.
 * "Please retry in 17h49m44.501618946s". Fall back to Retry-After, then to a
 * conservative six hours when the body only says "per day".
 */
export const parseQuotaResetMs = (body: string, retryAfterHeader?: string | null) => {
  const headerSeconds = Number(retryAfterHeader);
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) return headerSeconds * 1000;

  const match = body.match(/retry in\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*([\d.]+)\s*s/i);
  if (match) {
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const total = ((hours * 60 + minutes) * 60 + seconds) * 1000;
    if (total > 0) return total;
  }

  if (/per day|daily/i.test(body)) return 6 * 60 * 60 * 1000;
  return 0;
};

export const isQuotaExhausted = (status: number, body: string) =>
  status === 429 || /RESOURCE_EXHAUSTED/.test(body);

export const blockQuota = async (options: {
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
    console.error("Could not persist Gemini quota state", error);
  });
  console.warn(
    `Gemini quota exhausted (${options.model}); blocking calls until ${until.toISOString()} — ${options.reason.slice(
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

/** Daily narration-attempt budget, so a reset cannot burn the whole cap at once. */
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

export const quotaSnapshot = async () => {
  const state = await getQuotaState();
  const blocked = await isQuotaBlocked();
  const key = dayKey();
  return {
    model: state?.aiModel || "",
    blocked: blocked.blocked,
    blockedUntil: blocked.blocked ? blocked.until?.toISOString() : null,
    reason: blocked.blocked ? blocked.reason : null,
    attemptsToday: state?.attemptsDayKey === key ? state.attemptsToday : 0,
    dayKey: key,
    updatedAt: state?.updatedAt || null,
  };
};
