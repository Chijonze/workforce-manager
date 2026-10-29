import { acquireGeminiSlot, sleep } from "../../utils/geminiLimiter";
import { blockQuota, isQuotaBlocked, parseQuotaResetMs } from "../ai/quota.service";
import type { FrameBlock } from "./imagePrep";
import { BLOCK_SYSTEM_PROMPT, buildBlockPrompt, sanitizeBlockNarration, type BlockNarration } from "./prompt";
import { visionConfig } from "./vision.config";
import { redactPii } from "./vision.redact";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

class GeminiHttpError extends Error {
  status: number;
  retryAfterMs: number;

  constructor(status: number, message: string, retryAfterMs = 0) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const isRetryable = (error: unknown) =>
  error instanceof GeminiHttpError ? RETRYABLE_STATUS.has(error.status) : true;

const retryDelay = (error: unknown, attempt: number) => {
  if (error instanceof GeminiHttpError && error.retryAfterMs > 0) return error.retryAfterMs;
  return Math.min(20_000, 5_000 * 2 ** attempt);
};

const withRetry = async <T>(run: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 2) break;
      await sleep(retryDelay(error, attempt));
    }
  }
  throw lastError;
};

type GeminiPart = Record<string, unknown>;

const callGemini = async (
  model: string,
  systemPrompt: string,
  userPrompt: string,
  parts: GeminiPart[] = []
) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  await acquireGeminiSlot();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), visionConfig.requestTimeoutMs);

  try {
    const response = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }, ...parts] }],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      // The quota reset instant lives in the body ("Please retry in 17h49m…"),
      // not the headers, so parse before truncating.
      const detail = await response.text();
      throw new GeminiHttpError(
        response.status,
        `Gemini API error ${response.status}: ${detail.slice(0, 300)}`,
        parseQuotaResetMs(detail, response.headers.get("retry-after"))
      );
    }

    const data: any = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((part: any) => part?.text || "")
      .join("")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    if (!text) {
      throw new Error(
        data?.promptFeedback?.blockReason
          ? `Gemini blocked the request (${data.promptFeedback.blockReason})`
          : `Gemini returned an empty response${finishReason ? ` (${finishReason})` : ""}`
      );
    }

    return {
      parsed: JSON.parse(text),
      usage: {
        promptTokens: Number(data?.usageMetadata?.promptTokenCount) || 0,
        outputTokens: Number(data?.usageMetadata?.candidatesTokenCount) || 0,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
};

export type RoutedNarration = {
  narration: BlockNarration;
  source: "gemini" | "ocr" | "deterministic";
  model: string;
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
  error: string | null;
};

export type RouterInput = {
  block: FrameBlock;
  montage: Buffer | null;
  ocrText: string;
  ocrChars: number;
  /** Set by the caller when vision already failed for this block. */
  skipVision?: boolean;
};

/**
 * Provider ladder: vision first (best evidence), then OCR text if vision fails.
 * Whether the daily quota is exhausted is read from Mongo (quota.service), so a
 * restart or a new block does not each re-discover the same 429.
 */

/**
 * Last resort when both model providers are unavailable (quota exhausted or a
 * 503 spike). The OCR text is still real evidence, so return a narrow, clearly
 * low-confidence summary instead of losing the block entirely.
 */
const localOcrNarration = (text: string, frameCount: number): BlockNarration => {
  const lines = text
    .split("\n")
    .map((entry) => entry.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim())
    .filter((entry) => entry.length >= 8 && /[a-z]{3}/i.test(entry))
    .filter((entry, index, all) => all.indexOf(entry) === index);

  const excerpt = lines.slice(0, 5).join(" · ").slice(0, 300);

  return {
    summary: `OCR only (model unavailable), from ${frameCount} frame(s): ${excerpt}`,
    tasks: [],
    apps: [],
    activity: "unknown",
    evidence: (lines[0] || "").slice(0, 120),
    concerns: [],
    confidence: 20,
  };
};

export const narrateBlock = async (input: RouterInput): Promise<RoutedNarration> => {
  const started = Date.now();
  const errors: string[] = [];

  // One persisted check per block: while the daily cap is exhausted there is no
  // point hitting the API, and the retry sweep will pick this shift up later.
  const quota = await isQuotaBlocked();
  if (quota.blocked) {
    errors.push(`Gemini quota blocked until ${quota.until?.toISOString() || "unknown"}`);
  }

  const visionAvailable =
    !quota.blocked &&
    !input.skipVision &&
    visionConfig.enabled &&
    Boolean(input.montage);

  if (visionAvailable && input.montage) {
    try {
      const userPrompt = buildBlockPrompt(input.block, { ocrText: input.ocrText });
      const { parsed, usage } = await withRetry(() =>
        callGemini(visionConfig.model, BLOCK_SYSTEM_PROMPT, userPrompt, [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: input.montage!.toString("base64"),
            },
          },
        ])
      );

      const narration = sanitizeBlockNarration(parsed);
      if (narration.summary) {
        return {
          narration,
          source: "gemini",
          model: visionConfig.model,
          latencyMs: Date.now() - started,
          promptTokens: usage.promptTokens,
          outputTokens: usage.outputTokens,
          error: null,
        };
      }
      errors.push("vision returned an empty summary");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown vision failure";
      errors.push(message);
      if (error instanceof GeminiHttpError && error.status === 429) {
        await blockQuota({
          retryAfterMs: error.retryAfterMs,
          model: visionConfig.model,
          reason: message,
        });
      }
    }
  }

  const textPrompt = redactPii(input.ocrText.trim());
  if (!quota.blocked && textPrompt.length >= 40) {
    try {
      const { parsed, usage } = await withRetry(() =>
        callGemini(
          visionConfig.model,
          `${BLOCK_SYSTEM_PROMPT} The worker's screen text was extracted with OCR; use it as the only evidence.`,
          JSON.stringify({
            captureWindow: `${input.block.startedAt.toISOString()} to ${input.block.endedAt.toISOString()}`,
            frameCount: input.block.frames.length,
            screenText: textPrompt.slice(0, 4000),
          })
        )
      );

      const narration = sanitizeBlockNarration(parsed);
      if (narration.summary) {
        return {
          narration,
          source: "ocr",
          model: visionConfig.model,
          latencyMs: Date.now() - started,
          promptTokens: usage.promptTokens,
          outputTokens: usage.outputTokens,
          error: errors.join(" | ") || null,
        };
      }
      errors.push("OCR fallback returned an empty summary");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown OCR fallback failure");
    }
  }

  if (textPrompt.length >= 40) {
    return {
      narration: localOcrNarration(textPrompt, input.block.frames.length),
      source: "deterministic",
      model: "ocr-local",
      latencyMs: Date.now() - started,
      promptTokens: 0,
      outputTokens: 0,
      error: errors.join(" | ") || null,
    };
  }

  throw new Error(errors.join(" | ") || "No narration provider was available");
};
