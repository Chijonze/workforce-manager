import fs from "fs/promises";
import sharp from "sharp";

export type CaptureLike = {
  seq: number;
  capturedAt: Date | string;
  filePath: string;
  mimeType?: string;
};

export type PreparedFrame = {
  seq: number;
  capturedAt: Date;
  filePath: string;
  /** 64-bit difference hash, hex encoded. */
  hash: string;
  blank: boolean;
  width: number;
  height: number;
  /** Sequence number of the earlier frame this one duplicates, if any. */
  duplicateOf: number | null;
};

export type PreparedCaptureSet = {
  frames: PreparedFrame[];
  /** Unique, non-blank frames in chronological order. */
  kept: PreparedFrame[];
  duplicatesSkipped: number;
  blankFrames: number;
  missingFiles: number;
};

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const MAX_INPUT_PIXELS = 40_000_000;
const BLANK_RANGE_THRESHOLD = 12;

const POPCOUNT = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    table[i] = (i & 1) + table[i >> 1];
  }
  return table;
})();

const toHex = (bits: string) => {
  let out = "";
  for (let i = 0; i < 64; i += 4) {
    out += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return out;
};

const hashPixels = (pixels: Buffer) => {
  let bits = "";
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const index = y * HASH_WIDTH + x;
      bits += pixels[index] > pixels[index + 1] ? "1" : "0";
    }
  }
  return toHex(bits);
};

export const hammingDistance = (left: string, right: string) => {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  let distance = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    distance += POPCOUNT[a[i] ^ b[i]];
  }
  return distance;
};

const analysableBuffer = (buffer: Buffer) => sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS });

/**
 * Reads every capture once, computing a perceptual hash, dimensions and a
 * blank-screen flag. Duplicates are compared against the last few kept frames
 * (not just the previous one) so an A→B→A switch is still collapsed.
 */
export const prepareFrames = async (
  captures: CaptureLike[],
  options: { dedupeDistance: number; maxCaptures: number }
): Promise<PreparedCaptureSet> => {
  // Keep the most recent N in chronological order; older captures are the ones
  // a free-tier quota can least afford.
  const ordered = [...captures]
    .filter((capture) => capture?.filePath)
    .sort((left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime())
    .slice(-options.maxCaptures);

  const frames: PreparedFrame[] = [];
  const kept: PreparedFrame[] = [];
  let duplicatesSkipped = 0;
  let blankFrames = 0;
  let missingFiles = 0;

  for (const capture of ordered) {
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(capture.filePath);
    } catch {
      missingFiles += 1;
      continue;
    }

    try {
      const image = analysableBuffer(buffer);
      const metadata = await image.metadata();
      const { data } = await image
        .rotate()
        .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let min = 255;
      let max = 0;
      for (const value of data) {
        if (value < min) min = value;
        if (value > max) max = value;
      }

      const frame: PreparedFrame = {
        seq: capture.seq,
        capturedAt: new Date(capture.capturedAt),
        filePath: capture.filePath,
        hash: hashPixels(data),
        blank: max - min < BLANK_RANGE_THRESHOLD,
        width: metadata.width || 0,
        height: metadata.height || 0,
        duplicateOf: null,
      };

      if (frame.blank) {
        blankFrames += 1;
        frames.push(frame);
        continue;
      }

      const window = kept.slice(-3);
      const match = window.find(
        (candidate) => hammingDistance(candidate.hash, frame.hash) <= options.dedupeDistance
      );
      if (match) {
        frame.duplicateOf = match.seq;
        duplicatesSkipped += 1;
      } else {
        kept.push(frame);
      }

      frames.push(frame);
    } catch {
      missingFiles += 1;
    }
  }

  return { frames, kept, duplicatesSkipped, blankFrames, missingFiles };
};

/**
 * Evenly samples the timeline down to `limit` frames, always keeping the first
 * and last so the shift's start and end are still represented.
 */
export const sampleFrames = (frames: PreparedFrame[], limit: number) => {
  if (limit <= 0) return [];
  if (frames.length <= limit) return frames;
  if (limit === 1) return [frames[frames.length - 1]];

  const sampled: PreparedFrame[] = [];
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round((i * (frames.length - 1)) / (limit - 1));
    if (!sampled.length || sampled[sampled.length - 1].seq !== frames[index].seq) {
      sampled.push(frames[index]);
    }
  }
  return sampled;
};

export type FrameBlock = {
  index: number;
  frames: PreparedFrame[];
  startedAt: Date;
  endedAt: Date;
};

export const groupIntoBlocks = (frames: PreparedFrame[], blockFrames: number): FrameBlock[] =>
  frames.reduce<FrameBlock[]>((blocks, frame) => {
    const current = blocks[blocks.length - 1];
    if (current && current.frames.length < blockFrames) {
      current.frames.push(frame);
      current.endedAt = frame.capturedAt;
      return blocks;
    }
    blocks.push({
      index: blocks.length,
      frames: [frame],
      startedAt: frame.capturedAt,
      endedAt: frame.capturedAt,
    });
    return blocks;
  }, []);

/** Raw captures inside a block's window, including frames that were deduped. */
export const countCapturesBetween = (captures: CaptureLike[], start: Date, end: Date) => {
  const from = start.getTime();
  const to = end.getTime();
  return captures.filter((capture) => {
    const at = new Date(capture.capturedAt).getTime();
    return at >= from && at <= to;
  }).length;
};
