import sharp, { type OverlayOptions } from "sharp";
import type { PreparedFrame } from "./imagePrep";
import { formatCaptureTime } from "./vision.time";
import { businessTimeZone } from "./vision.config";

const PADDING = 8;
const CAPTION_HEIGHT = 26;
const BACKGROUND = "#0f172a";
const TILE_BACKGROUND = "#020617";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type Montage = {
  buffer: Buffer;
  width: number;
  height: number;
};

/**
 * Builds one contact sheet per block: chronological capture tiles, each
 * captioned with its sequence number and wall-clock time, on a dark canvas.
 * A single image per block is what keeps the vision call count (and therefore
 * the free-tier quota) low.
 */
export const buildMontage = async (
  frames: PreparedFrame[],
  options: { tileWidth: number; timeZone?: string }
): Promise<Montage | null> => {
  if (!frames.length) return null;

  const timeZone = options.timeZone || businessTimeZone();
  const tileWidth = options.tileWidth;
  const tileHeight = Math.round((tileWidth * 9) / 16);
  const columns = frames.length > 1 ? 2 : 1;
  const rows = Math.ceil(frames.length / columns);
  const cellWidth = tileWidth;
  const cellHeight = tileHeight + CAPTION_HEIGHT;
  const width = PADDING + columns * (cellWidth + PADDING);
  const height = PADDING + rows * (cellHeight + PADDING);

  const captions: string[] = [];
  const tiles: OverlayOptions[] = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = PADDING + column * (cellWidth + PADDING);
    const top = PADDING + row * (cellHeight + PADDING);

    captions.push(
      `<text x="${left + 2}" y="${top + 17}" font-family="Segoe UI, Arial, sans-serif" ` +
        `font-size="14" fill="#94a3b8">#${frame.seq} · ${escapeXml(
          formatCaptureTime(frame.capturedAt, timeZone)
        )}</text>`
    );

    try {
      const tile = await sharp(frame.filePath, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(tileWidth, tileHeight, {
          fit: "contain",
          background: TILE_BACKGROUND,
        })
        .jpeg({ quality: 84 })
        .toBuffer();
      tiles.push({ input: tile, left, top: top + CAPTION_HEIGHT });
    } catch {
      // A file that vanished between hashing and rendering just leaves a gap.
    }
  }

  const background = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="${BACKGROUND}"/>` +
      captions.join("") +
      `</svg>`
  );

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([{ input: background, left: 0, top: 0 }, ...tiles])
    .jpeg({ quality: 82 })
    .toBuffer();

  return { buffer, width, height };
};
