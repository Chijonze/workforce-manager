import type { BlockActivity } from "../../models/ActivityNarration";
import type { FrameBlock } from "./imagePrep";
import { formatCaptureTime, formatWindow } from "./vision.time";
import { businessTimeZone } from "./vision.config";

export type BlockNarration = {
  summary: string;
  tasks: string[];
  apps: string[];
  activity: BlockActivity;
  evidence: string;
  concerns: string[];
  confidence: number;
};

const CONTRACT = `{
  "summary": "3-5 sentences telling the story of what the worker did in these frames, naming the screens, documents and task steps you can see (max 140 words)",
  "tasks": ["concrete task labels, max 6"],
  "apps": ["application or website names visible, max 6"],
  "activity": "focused" | "mixed" | "idle" | "unknown",
  "evidence": "one short phrase of on-screen text that proves the activity (max 160 chars)",
  "concerns": ["0-3 short flags, e.g. credentials visible, non-work browsing"],
  "confidence": 0-100
}`;

const SYSTEM_PROMPT = [
  "You are a workforce activity analyst. You receive a contact sheet of screenshots captured periodically from one worker's computer during a shift.",
  "The tiles are in chronological order and each is labelled with its capture number and the local time. You may also receive OCR text extracted from the same frames.",
  "Your job is to narrate what work was actually being done from the visible evidence: name the applications, websites, documents, tickets, spreadsheets or chat threads on screen, and describe the sequence of the task being performed.",
  "Rules:",
  "1. Describe only what the pixels and OCR text support. If the frames are ambiguous, say so and lower confidence.",
  "2. Never invent names, numbers, or outcomes. Do not guess the worker's identity.",
  "3. Protect personal data: do not transcribe customer names, email addresses, phone numbers, card numbers or home addresses. Refer to them generically (e.g. 'a customer record').",
  "4. If a password, API key or card number is visible on screen, mention 'credentials visible' in concerns without reproducing the value.",
  "5. A locked, black or uniform screen means idle or away, not focused work.",
  "6. Non-work content (social feeds, video, shopping) should be stated factually as non-work activity, without judgemental language.",
  "7. Write in British English, in the past tense, as evidence for a hiring manager reading a written report.",
  "8. Be concrete and neutral. No praise, no speculation about attitude.",
  `Respond with strict JSON only, exactly matching this contract: ${CONTRACT}`,
].join(" ");

export const buildBlockPrompt = (
  block: FrameBlock,
  options: { ocrText?: string; timeZone?: string }
) => {
  const timeZone = options.timeZone || businessTimeZone();
  const payload: Record<string, unknown> = {
    captureWindow: formatWindow(block.startedAt, block.endedAt, timeZone),
    frameCount: block.frames.length,
    frames: block.frames.map((frame) => ({
      capture: frame.seq,
      time: formatCaptureTime(frame.capturedAt, timeZone),
      resolution: `${frame.width}x${frame.height}`,
    })),
  };

  if (options.ocrText && options.ocrText.trim().length >= 40) {
    // OCR is a second, independent reading of the screen; it is the best source
    // of exact application, document and ticket names.
    payload.ocrText = options.ocrText.slice(0, 6000);
  }

  return JSON.stringify(payload);
};

const asString = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";

const asStringList = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value)
    ? value
        .map((item) => asString(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const ACTIVITY_VALUES: Record<string, BlockActivity> = {
  focused: "focused",
  focus: "focused",
  working: "focused",
  active: "focused",
  productive: "focused",
  mixed: "mixed",
  intermittent: "mixed",
  idle: "idle",
  away: "idle",
  inactive: "idle",
  blank: "idle",
  unknown: "unknown",
};

const asActivity = (value: unknown): BlockActivity => {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ACTIVITY_VALUES[key] || "unknown";
};

export const sanitizeBlockNarration = (raw: unknown): BlockNarration => {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const confidence = Number(record.confidence);

  return {
    summary: asString(record.summary, 1600),
    tasks: asStringList(record.tasks, 6, 90),
    apps: asStringList(record.apps, 6, 70),
    activity: asActivity(record.activity),
    evidence: asString(record.evidence, 240),
    concerns: asStringList(record.concerns, 3, 160),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
  };
};

export const BLOCK_SYSTEM_PROMPT = SYSTEM_PROMPT;
