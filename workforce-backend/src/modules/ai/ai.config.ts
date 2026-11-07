const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

export type AiThinkingSetting = "auto" | "on" | "off";

const thinkingSetting = (): AiThinkingSetting => {
  const raw = (process.env.AI_THINKING || "off").toLowerCase();
  if (raw === "on" || raw === "enabled" || raw === "true") return "on";
  if (raw === "auto") return "auto";
  return "off";
};

const effort = (): "low" | "high" | "max" => {
  const raw = (process.env.AI_REASONING_EFFORT || "high").toLowerCase();
  if (raw === "low" || raw === "high" || raw === "max") return raw;
  return "high";
};

const baseUrl = () =>
  (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");

/**
 * Single source of truth for the AI provider that writes shift and period
 * reports. The product never exposes the vendor or model name to users: reports
 * are branded as "ShiftSync AI". Keep the provider plumbing here so switching or
 * upgrading models is an env change, not a code change.
 */
export const aiConfig = {
  /** Vendor label used only in server logs. Never returned by the API. */
  provider: "deepseek",
  baseUrl,
  apiKey: () => (process.env.DEEPSEEK_API_KEY || "").trim(),
  configured: () => Boolean((process.env.DEEPSEEK_API_KEY || "").trim()),

  /**
   * Lightweight multimodal model used for both the long-form analysis and the
   * screenshot narration. `deepseek-flash` reads image input (screenshots,
   * contact sheets) and returns strict JSON.
   */
  analysisModel: process.env.AI_ANALYSIS_MODEL || "deepseek-flash",
  visionModel: process.env.AI_VISION_MODEL || "deepseek-flash",

  /** Output budgets. Long reports need room; JSON mode truncates otherwise. */
  analysisMaxTokens: int(process.env.AI_ANALYSIS_MAX_TOKENS, 7000, 1200, 32_768),
  aggregateMaxTokens: int(process.env.AI_AGGREGATE_MAX_TOKENS, 9000, 1500, 32_768),
  narrationMaxTokens: int(process.env.AI_NARRATION_MAX_TOKENS, 1400, 300, 8192),

  /** Hard ceilings for one request; thinking mode can be slow on big reports. */
  analysisTimeoutMs: int(process.env.AI_ANALYSIS_TIMEOUT_MS, 180_000, 15_000, 600_000),
  aggregateTimeoutMs: int(process.env.AI_AGGREGATE_TIMEOUT_MS, 300_000, 30_000, 900_000),
  visionTimeoutMs: int(process.env.AI_VISION_TIMEOUT_MS, 150_000, 15_000, 600_000),

  thinking: thinkingSetting(),
  reasoningEffort: effort(),

  /**
   * `auto` lets thinking mode run only for the long period report (a deliberate
   * button press that can wait) and keeps per-shift/ narration calls fast.
   */
  thinkingFor: (purpose: "analysis" | "aggregate" | "narration") => {
    if (thinkingSetting() === "on") return true;
    if (thinkingSetting() === "off") return false;
    return purpose === "aggregate";
  },

  retryAttempts: int(process.env.AI_RETRY_ATTEMPTS, 3, 1, 6),
  retryBaseMs: int(process.env.AI_RETRY_BASE_MS, 2000, 250, 30_000),
};
