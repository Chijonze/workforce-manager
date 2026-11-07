import { aiConfig } from "./ai.config";
import { acquireAiSlot, sleep } from "./ai.limiter";
import { isQuotaBlocked, noteProviderThrottle, parseRetryDelayMs } from "./quota.service";

export type AiImage = {
  base64: string;
  mimeType: string;
};

export type AiPurpose = "analysis" | "aggregate" | "narration";

export type AiJsonRequest = {
  purpose: AiPurpose;
  system: string;
  user: string;
  /** Images rendered into the user turn (screenshots / contact sheets). */
  images?: AiImage[];
  maxTokens: number;
  timeoutMs?: number;
  /** Stable pseudonymous id for provider-side isolation. Never PII. */
  userId?: string;
  temperature?: number;
};

export type AiJsonResult = {
  data: unknown;
  model: string;
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
  finishReason: string;
};

class AiHttpError extends Error {
  status: number;
  retryAfterMs: number;

  constructor(status: number, message: string, retryAfterMs = 0) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const isRetryable = (error: unknown) =>
  error instanceof AiHttpError ? RETRYABLE_STATUS.has(error.status) : true;

const retryDelayMs = (error: unknown, attempt: number) => {
  if (error instanceof AiHttpError && error.retryAfterMs > 0) return error.retryAfterMs;
  return Math.min(20_000, aiConfig.retryBaseMs * 2 ** attempt);
};

const errorMessageOf = (body: string) => {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; type?: string; code?: string };
      message?: string;
    };
    return parsed?.error?.message || parsed?.message || body.slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
};

/**
 * JSON mode can return blank content when the model produces something the API
 * cannot coerce, and a long report can arrive wrapped in a markdown fence. This
 * accepts all three shapes while still rejecting genuinely broken output.
 */
export const parseJsonResponse = (text: string): unknown => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!cleaned) throw new Error("The model returned an empty response");

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to the outer-object salvage below.
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error("The model returned malformed JSON");
    }
  }

  throw new Error("The model returned a response that was not JSON");
};

const buildBody = (request: AiJsonRequest, model: string) => {
  const thinking = aiConfig.thinkingFor(request.purpose);
  const content = request.images?.length
    ? [
        { type: "text", text: request.user },
        ...request.images.map((image) => ({
          type: "image_url",
          image_url: {
            // `original` keeps small UI text legible; the provider resizes large
            // frames internally anyway.
            url: `data:${image.mimeType};base64,${image.base64}`,
            detail: "original",
          },
        })),
      ]
    : request.user;

  return {
    model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content },
    ],
    // OpenAI-compatible JSON output. The prompt also contains the word "JSON",
    // which the provider requires for this mode.
    response_format: { type: "json_object" },
    max_tokens: request.maxTokens,
    stream: false,
    thinking: { type: thinking ? "enabled" : "disabled" },
    ...(thinking
      ? { reasoning_effort: aiConfig.reasoningEffort }
      : {
          // Thinking mode ignores temperature, so only send it when it applies.
          temperature: request.temperature ?? 0.25,
        }),
    ...(request.userId ? { user_id: request.userId } : {}),
  };
};

/**
 * One JSON call to the multimodal provider. Retries throttles and transient 5xx
 * itself, then throws; callers fall back to their deterministic report.
 */
export const callAiJson = async (request: AiJsonRequest): Promise<AiJsonResult> => {
  const apiKey = aiConfig.apiKey();
  if (!apiKey) throw new Error("The AI provider is not configured");

  const model = request.purpose === "narration" ? aiConfig.visionModel : aiConfig.analysisModel;
  const timeoutMs =
    request.timeoutMs ||
    (request.purpose === "aggregate" ? aiConfig.aggregateTimeoutMs : aiConfig.analysisTimeoutMs);
  const started = Date.now();

  // Respect a recent throttle without hammering the provider.
  const blocked = await isQuotaBlocked();
  if (blocked.blocked && blocked.until) {
    const waitMs = blocked.until.getTime() - Date.now();
    if (waitMs > 3_000) {
      throw new Error("The AI provider is briefly rate limited; try again shortly");
    }
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < aiConfig.retryAttempts; attempt += 1) {
    if (attempt > 0) await sleep(retryDelayMs(lastError, attempt - 1));
    await acquireAiSlot();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${aiConfig.baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(buildBody(request, model)),
      });

      if (!response.ok) {
        const detail = await response.text();
        const retryAfterMs = parseRetryDelayMs(detail, response.headers.get("retry-after"));
        const message = errorMessageOf(detail);

        if (response.status === 429 || /rate.?limit|concurrency|overloaded/i.test(detail)) {
          await noteProviderThrottle({ retryAfterMs, model, reason: detail.slice(0, 400) });
        }

        throw new AiHttpError(
          response.status,
          `AI provider error ${response.status}: ${message}`,
          retryAfterMs
        );
      }

      const payload: any = await response.json();
      const choice = payload?.choices?.[0];
      const finishReason = String(choice?.finish_reason || "");
      const text = String(choice?.message?.content ?? "").trim();

      if (!text) {
        // JSON-mode quirk: blank content with finish_reason=stop. One more try is
        // cheaper than failing a report outright.
        throw new Error(`The model returned an empty response${finishReason ? ` (${finishReason})` : ""}`);
      }

      let data: unknown;
      try {
        data = parseJsonResponse(text);
      } catch (parseError) {
        if (finishReason === "length") {
          throw new Error(
            "The model response was truncated before the JSON was complete; raise AI_ANALYSIS_MAX_TOKENS"
          );
        }
        throw parseError;
      }

      const usage = {
        promptTokens: Number(payload?.usage?.prompt_tokens || 0),
        outputTokens: Number(payload?.usage?.completion_tokens || 0),
      };
      const latencyMs = Date.now() - started;
      // Cost observability: token usage stays in server logs, never in an API
      // response, because it would identify the provider.
      console.info(
        `AI ${request.purpose}: ${model} · ${usage.promptTokens} in / ${usage.outputTokens} out · ${latencyMs}ms · finish=${finishReason || "n/a"}`
      );

      return {
        data,
        model,
        latencyMs,
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        finishReason,
      };
    } catch (error) {
      lastError = error;
      const aborted =
        error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message));
      // Retrying a request that already consumed its full timeout only multiplies
      // the wait; the caller is better served by the deterministic report.
      if (aborted || !isRetryable(error) || attempt === aiConfig.retryAttempts - 1) break;
      console.warn(
        `AI ${request.purpose} attempt ${attempt + 1} failed, retrying:`,
        error instanceof Error ? error.message : error
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("The AI request failed");
};

export const aiConfigured = () => aiConfig.configured();
