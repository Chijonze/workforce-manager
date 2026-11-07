import { aiConfig } from "../ai/ai.config";

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

export type OcrMode = "always" | "fallback" | "off";

const ocrMode = (): OcrMode => {
  const raw = (process.env.VISION_OCR_MODE || "always").toLowerCase();
  if (raw === "fallback" || raw === "off") return raw;
  return "always";
};

/**
 * Screenshot-narration settings. Every one of these is an env override so the
 * pipeline can be tuned per deployment without a code change.
 *
 * The narration model is multimodal: each block of frames is sent as one contact
 * sheet, alongside locally extracted OCR text. Two independent readings of the
 * screen (pixels + text) make the narration considerably more specific about
 * applications, documents and tasks than either alone.
 */
export const visionConfig = {
  enabled: process.env.VISION_ENABLED !== "false",
  model: aiConfig.visionModel,
  /** Max unique frames per narrated block (one model call per block). */
  blockFrames: int(process.env.VISION_BLOCK_FRAMES, 6, 1, 12),
  /** Hard cap on model calls per shift; frames are sampled to fit. */
  maxBlocks: int(process.env.VISION_MAX_BLOCKS, 8, 1, 24),
  maxCaptures: int(process.env.VISION_MAX_CAPTURES, 96, 1, 96),
  /** Width of one tile inside the contact sheet. */
  tileWidth: int(process.env.VISION_TILE_WIDTH, 720, 320, 1280),
  /** Hamming distance (of 64 bits) at or below which two frames are duplicates. */
  dedupeDistance: int(process.env.VISION_DEDUPE_DISTANCE, 5, 0, 32),
  ocrMode: ocrMode(),
  ocrMaxChars: int(process.env.VISION_OCR_MAX_CHARS, 4000, 200, 12_000),
  /** Longest an inline call may spend building narration before giving up. */
  inlineBudgetMs: int(process.env.VISION_INLINE_BUDGET_MS, 90_000, 5_000, 300_000),
  requestTimeoutMs: aiConfig.visionTimeoutMs,
  /** Background retry of shifts whose narration failed or was cut short. */
  retryEnabled: process.env.VISION_RETRY_ENABLED !== "false",
  retryIntervalMs: int(process.env.VISION_RETRY_INTERVAL_MS, 900_000, 60_000, 86_400_000),
  retryMaxShiftsPerDay: int(process.env.VISION_RETRY_MAX_SHIFTS_PER_DAY, 12, 1, 96),
  retryLookbackDays: int(process.env.VISION_RETRY_LOOKBACK_DAYS, 7, 1, 30),
};

export const businessTimeZone = () => process.env.BUSINESS_TIME_ZONE || "Africa/Lagos";
