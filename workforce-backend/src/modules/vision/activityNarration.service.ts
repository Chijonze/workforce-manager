import fs from "fs/promises";
import ActivityNarration, {
  IActivityNarration,
  INarrationBlock,
  INarrationCoverage,
} from "../../models/ActivityNarration";
import MonitoringSession from "../../models/MonitoringSession";
import ShiftSession from "../../models/ShiftSession";
import {
  countCapturesBetween,
  groupIntoBlocks,
  prepareFrames,
  sampleFrames,
  type FrameBlock,
  type PreparedFrame,
} from "./imagePrep";
import { buildMontage } from "./montage";
import { createOcrSession, type OcrSession } from "./ocr";
import { narrateBlock } from "./router";
import { businessTimeZone, visionConfig } from "./vision.config";
import { formatCaptureTime } from "./vision.time";

const MAX_OVERVIEW_CHARS = 1600;
const OCR_FRAME_SAMPLE = 2;

const emptyCoverage = (): INarrationCoverage => ({
  captures: 0,
  uniqueFrames: 0,
  duplicatesSkipped: 0,
  blankFrames: 0,
  missingFiles: 0,
  blocks: 0,
  visionCalls: 0,
  ocrFrames: 0,
  skippedFrames: 0,
});

/**
 * Locked or blank screens are real evidence of idle time, and they need no
 * model call: turn consecutive blank captures into deterministic "screen was
 * off" blocks so the narrative covers the whole shift instead of silently
 * skipping those windows.
 */
const IDLE_RUN_GAP_MS = 45 * 60_000;

const buildIdleBlocks = (frames: PreparedFrame[]): INarrationBlock[] => {
  const blanks = frames
    .filter((frame) => frame.blank)
    .sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime());

  const runs: PreparedFrame[][] = [];
  for (const frame of blanks) {
    const run = runs[runs.length - 1];
    const previous = run?.[run.length - 1];
    if (run && previous && frame.capturedAt.getTime() - previous.capturedAt.getTime() <= IDLE_RUN_GAP_MS) {
      run.push(frame);
    } else {
      runs.push([frame]);
    }
  }

  return runs.map((run) => ({
    index: 0,
    startedAt: run[0].capturedAt,
    endedAt: run[run.length - 1].capturedAt,
    frameSeqs: run.map((frame) => frame.seq),
    captureCount: run.length,
    uniqueFrameCount: 0,
    summary: `Screen locked or blank across ${run.length} capture(s) — no visible activity.`,
    tasks: [],
    apps: [],
    activity: "idle" as const,
    evidence: "",
    concerns: run.length >= 3 ? ["Extended screen inactivity"] : [],
    confidence: 90,
    source: "deterministic" as const,
    model: "",
    ocrChars: 0,
    imageBytes: 0,
    latencyMs: 0,
    error: null,
  }));
};

const composeOverview = (blocks: INarrationBlock[], timeZone: string) =>  blocks
    .filter((block) => block.summary)
    .map(
      (block) =>
        `${formatCaptureTime(block.startedAt, timeZone)}–${formatCaptureTime(
          block.endedAt,
          timeZone
        )}: ${block.summary}`
    )
    .join(" ")
    .slice(0, MAX_OVERVIEW_CHARS);

const ocrForBlock = async (
  block: FrameBlock,
  session: OcrSession | null,
  counter: { frames: number }
): Promise<string> => {
  if (!session || visionConfig.ocrMode === "off") return "";

  const picks =
    block.frames.length <= OCR_FRAME_SAMPLE
      ? block.frames
      : [
          block.frames[0],
          block.frames[Math.floor(block.frames.length / 2)],
          block.frames[block.frames.length - 1],
        ].slice(0, OCR_FRAME_SAMPLE);

  const parts: string[] = [];
  for (const frame of picks) {
    try {
      const text = await session.recognize(await fs.readFile(frame.filePath));
      counter.frames += 1;
      if (text) parts.push(text);
    } catch {
      // OCR is best-effort; the vision provider still has the images.
    }
  }

  return parts.join("\n---\n").slice(0, visionConfig.ocrMaxChars);
};

export type GenerateNarrationOptions = {
  force?: boolean;
  /** Soft deadline; blocks not reached in time are recorded as skipped. */
  budgetMs?: number;
};

/**
 * Builds (or returns) the per-shift screen narration:
 *   capture set → perceptual dedupe → chronological blocks → contact sheet per
 *   block → Gemini vision (OCR text provider as fallback) → persisted summary.
 *
 * Output is cached per shift so a shift is only ever paid for once.
 */
export const generateActivityNarration = async (
  shiftId: string,
  options: GenerateNarrationOptions = {}
): Promise<IActivityNarration> => {
  const shift = await ShiftSession.findById(shiftId).lean();
  if (!shift) throw new Error("Shift not found");

  const existing = await ActivityNarration.findOne({ shiftSessionId: shift._id });
  if (existing && existing.status === "completed" && !options.force) return existing;

  const session = await MonitoringSession.findOne({ shiftSessionId: shift._id }).lean();
  const captures = (session?.captures || []).map((capture: any) => ({
    seq: capture.seq,
    capturedAt: capture.capturedAt,
    filePath: capture.filePath,
  }));

  const persist = async (fields: Record<string, unknown>): Promise<IActivityNarration> =>
    (await ActivityNarration.findOneAndUpdate(
      { shiftSessionId: shift._id },
      {
        shiftSessionId: shift._id,
        userId: String(shift.userId),
        generatedAt: new Date(),
        ...fields,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )) as IActivityNarration;

  if (!visionConfig.enabled) {
    return persist({
      status: "empty",
      blocks: [],
      overview: "",
      coverage: emptyCoverage(),
      source: "none",
      aiModel: "",
      error: "Screenshot narration is disabled (VISION_ENABLED=false)",
    });
  }

  if (!captures.length) {
    return persist({
      status: "empty",
      blocks: [],
      overview: "",
      coverage: emptyCoverage(),
      source: "none",
      aiModel: "",
      error: "No screenshots were captured for this shift",
    });
  }

  const startedAt = Date.now();
  const deadline = options.budgetMs ? startedAt + options.budgetMs : Number.POSITIVE_INFINITY;
  const timeZone = businessTimeZone();

  const prepared = await prepareFrames(captures, {
    dedupeDistance: visionConfig.dedupeDistance,
    maxCaptures: visionConfig.maxCaptures,
  });

  const frameBudget = visionConfig.maxBlocks * visionConfig.blockFrames;
  const selected = sampleFrames(prepared.kept, frameBudget);
  const blocks = groupIntoBlocks(selected, visionConfig.blockFrames);

  const coverage = {
    ...emptyCoverage(),
    captures: captures.length,
    uniqueFrames: prepared.kept.length,
    duplicatesSkipped: prepared.duplicatesSkipped,
    blankFrames: prepared.blankFrames,
    missingFiles: prepared.missingFiles,
    blocks: blocks.length,
  };

  const ocrSession = visionConfig.ocrMode === "off" ? null : await createOcrSession();
  const ocrCounter = { frames: 0 };
  const narratedBlocks: INarrationBlock[] = [];

  // A previous run may have stopped on the inline budget mid-shift. Reuse the
  // blocks it already finished so repeated calls converge instead of paying for
  // block 1 every time.
  const priorByStart = new Map<number, INarrationBlock>();
  for (const prior of existing?.blocks || []) {
    if (prior.summary && prior.source !== "deterministic") {
      priorByStart.set(new Date(prior.startedAt).getTime(), prior);
    }
  }

  try {
    for (const block of blocks) {
      const prior = priorByStart.get(block.startedAt.getTime());
      if (prior) {
        narratedBlocks.push(prior);
        continue;
      }

      if (Date.now() >= deadline) {
        coverage.skippedFrames += block.frames.length;
        continue;
      }

      const record: INarrationBlock = {
        index: block.index,
        startedAt: block.startedAt,
        endedAt: block.endedAt,
        frameSeqs: block.frames.map((frame) => frame.seq),
        captureCount: countCapturesBetween(captures, block.startedAt, block.endedAt),
        uniqueFrameCount: block.frames.length,
        summary: "",
        tasks: [],
        apps: [],
        activity: "unknown",
        evidence: "",
        concerns: [],
        confidence: 0,
        source: "gemini",
        model: visionConfig.model,
        ocrChars: 0,
        imageBytes: 0,
        latencyMs: 0,
        error: null,
      };

      let ocrText = "";
      try {
        const montage = await buildMontage(block.frames, {
          tileWidth: visionConfig.tileWidth,
          timeZone,
        });
        record.imageBytes = montage?.buffer.length || 0;

        if (visionConfig.ocrMode === "always") {
          ocrText = await ocrForBlock(block, ocrSession, ocrCounter);
        }

        try {
          const routed = await narrateBlock({
            block,
            montage: montage?.buffer || null,
            ocrText,
            ocrChars: ocrText.length,
          });
          record.summary = routed.narration.summary;
          record.tasks = routed.narration.tasks;
          record.apps = routed.narration.apps;
          record.activity = routed.narration.activity;
          record.evidence = routed.narration.evidence;
          record.concerns = routed.narration.concerns;
          record.confidence = routed.narration.confidence;
          record.source = routed.source;
          record.model = routed.model;
          record.latencyMs = routed.latencyMs;
          record.ocrChars = ocrText.length;
          if (routed.source === "gemini") coverage.visionCalls += 1;
        } catch (error) {
          // Vision failed: OCR the frames, then ask the text provider.
          if (!ocrText) ocrText = await ocrForBlock(block, ocrSession, ocrCounter);
          if (ocrText.length >= 40) {
            const routed = await narrateBlock({
              block,
              montage: null,
              ocrText,
              ocrChars: ocrText.length,
              skipVision: true,
            });
            record.summary = routed.narration.summary;
            record.tasks = routed.narration.tasks;
            record.apps = routed.narration.apps;
            record.activity = routed.narration.activity;
            record.evidence = routed.narration.evidence;
            record.concerns = routed.narration.concerns;
            record.confidence = routed.narration.confidence;
            record.source = routed.source;
            record.model = routed.model;
            record.latencyMs = routed.latencyMs;
            record.error = error instanceof Error ? error.message : "vision failed";
          } else {
            record.error = error instanceof Error ? error.message : "narration failed";
            record.confidence = 0;
          }
          record.ocrChars = ocrText.length;
        }
      } catch (error) {
        record.error = error instanceof Error ? error.message : "narration failed";
      }

      coverage.ocrFrames = ocrCounter.frames;
      narratedBlocks.push(record);
    }
  } finally {
    await ocrSession?.close();
  }

  coverage.ocrFrames = ocrCounter.frames;

  const idleBlocks = buildIdleBlocks(prepared.frames);
  const orderedBlocks = [...narratedBlocks, ...idleBlocks]
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
    .map((block, index) => ({ ...block, index }));

  // A block that only produced a low-confidence OCR excerpt is not a success:
  // it should keep the shift "partial" so the next run retries with the model.
  const succeeded = narratedBlocks.filter(
    (block) => block.summary && (block.source !== "deterministic" || block.confidence >= 40)
  ).length;
  const status: IActivityNarration["status"] =
    succeeded === 0
      ? blocks.length === 0 && idleBlocks.length > 0
        ? "completed"
        : "failed"
      : succeeded < blocks.length || coverage.skippedFrames > 0
        ? "partial"
        : "completed";

  return persist({
    status,
    blocks: orderedBlocks,
    overview: composeOverview(orderedBlocks, timeZone),
    coverage,
    source: narratedBlocks.some((block) => block.source === "gemini")
      ? "gemini"
      : narratedBlocks.some((block) => block.source === "ocr")
        ? "ocr"
        : "none",
    aiModel: visionConfig.model,
    error:
      status === "failed"
        ? narratedBlocks.find((block) => block.error)?.error || "All narration providers failed"
        : null,
  });
};

export const getActivityNarration = (shiftId: string) =>
  ActivityNarration.findOne({ shiftSessionId: shiftId }).lean();

/**
 * Non-throwing wrapper used inside shift analysis: a narration failure must
 * never stop a performance report from being generated.
 */
export const ensureActivityNarration = async (
  shiftId: string,
  options: GenerateNarrationOptions = {}
): Promise<IActivityNarration | null> => {
  try {
    return await generateActivityNarration(shiftId, options);
  } catch (error) {
    console.error(
      "Screenshot narration failed; continuing without it",
      error instanceof Error ? error.message : error
    );
    return null;
  }
};
