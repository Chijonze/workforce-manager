import { aiConfig } from "../ai/ai.config";
import { callAiJson } from "../ai/ai.client";
import { isQuotaBlocked } from "../ai/quota.service";
import type { FrameBlock } from "./imagePrep";
import {
  BLOCK_SYSTEM_PROMPT,
  buildBlockPrompt,
  sanitizeBlockNarration,
  type BlockNarration,
} from "./prompt";
import { visionConfig } from "./vision.config";
import { redactPii } from "./vision.redact";

export type RoutedNarration = {
  narration: BlockNarration;
  source: "ai" | "ocr" | "deterministic";
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
 * Last resort when the model is unavailable. The OCR text is still real
 * evidence, so return a narrow, clearly low-confidence summary instead of losing
 * the block entirely.
 */
const localOcrNarration = (text: string, frameCount: number): BlockNarration => {
  const lines = text
    .split("\n")
    .map((entry) => entry.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim())
    .filter((entry) => entry.length >= 8 && /[a-z]{3}/i.test(entry))
    .filter((entry, index, all) => all.indexOf(entry) === index);

  const excerpt = lines.slice(0, 5).join(" · ").slice(0, 300);

  return {
    summary: `OCR only (analysis engine unavailable), from ${frameCount} frame(s): ${excerpt}`,
    tasks: [],
    apps: [],
    activity: "unknown",
    evidence: (lines[0] || "").slice(0, 120),
    concerns: [],
    confidence: 20,
  };
};

/**
 * Provider ladder: multimodal vision first (pixels + OCR text in one call), then
 * text-only narration from the OCR transcript, then a deterministic excerpt.
 */
export const narrateBlock = async (input: RouterInput): Promise<RoutedNarration> => {
  const started = Date.now();
  const errors: string[] = [];

  // One persisted check per block: a throttle pause applies to the whole worker.
  const quota = await isQuotaBlocked();
  if (quota.blocked) {
    errors.push(`Analysis engine paused until ${quota.until?.toISOString() || "unknown"}`);
  }

  const visionAvailable =
    !quota.blocked &&
    !input.skipVision &&
    visionConfig.enabled &&
    Boolean(input.montage);

  if (visionAvailable && input.montage) {
    try {
      const userPrompt = buildBlockPrompt(input.block, { ocrText: input.ocrText });
      const result = await callAiJson({
        purpose: "narration",
        system: BLOCK_SYSTEM_PROMPT,
        user: userPrompt,
        images: [{ base64: input.montage.toString("base64"), mimeType: "image/jpeg" }],
        maxTokens: aiConfig.narrationMaxTokens,
        timeoutMs: visionConfig.requestTimeoutMs,
      });

      const narration = sanitizeBlockNarration(result.data);
      if (narration.summary) {
        return {
          narration,
          source: "ai",
          model: result.model,
          latencyMs: Date.now() - started,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          error: null,
        };
      }
      errors.push("vision returned an empty summary");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown vision failure");
    }
  }

  const textPrompt = redactPii(input.ocrText.trim());
  if (!quota.blocked && textPrompt.length >= 40) {
    try {
      const result = await callAiJson({
        purpose: "narration",
        system: `${BLOCK_SYSTEM_PROMPT} The worker's screen text was extracted with OCR; use it as the primary evidence.`,
        user: JSON.stringify({
          captureWindow: `${input.block.startedAt.toISOString()} to ${input.block.endedAt.toISOString()}`,
          frameCount: input.block.frames.length,
          screenText: textPrompt.slice(0, 6000),
        }),
        maxTokens: aiConfig.narrationMaxTokens,
        timeoutMs: visionConfig.requestTimeoutMs,
      });

      const narration = sanitizeBlockNarration(result.data);
      if (narration.summary) {
        return {
          narration,
          source: "ocr",
          model: result.model,
          latencyMs: Date.now() - started,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          error: errors.join(" | ") || null,
        };
      }
      errors.push("OCR narration returned an empty summary");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown OCR narration failure");
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
