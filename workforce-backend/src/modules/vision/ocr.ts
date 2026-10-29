import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence?: number } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

export type OcrSession = {
  recognize: (buffer: Buffer) => Promise<string>;
  close: () => Promise<void>;
};

/**
 * Locates the bundled English traineddata so OCR works without a runtime
 * download. Returns undefined when the package is absent, in which case
 * tesseract.js falls back to fetching the data itself.
 */
const resolveLangPath = () => {
  try {
    const packageJson = require.resolve("@tesseract.js-data/eng/package.json");
    const root = path.dirname(packageJson);
    const candidates = fs
      .readdirSync(root)
      .filter((entry) => fs.statSync(path.join(root, entry)).isDirectory())
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    for (const entry of candidates) {
      const trainedData = path.join(root, entry, "eng.traineddata.gz");
      if (fs.existsSync(trainedData)) return path.dirname(trainedData);
    }
  } catch {
    // Fall through to tesseract.js' own download path.
  }
  return undefined;
};

const cleanText = (raw: string, maxChars: number) =>
  raw
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .join("\n")
    .slice(0, maxChars)
    .trim();

/**
 * One worker per narration run, reused across frames. Returns null when OCR is
 * unavailable (no package, no worker threads); callers then rely on vision.
 */
export const createOcrSession = async (): Promise<OcrSession | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require("tesseract.js") as {
      createWorker: (lang: string, oem?: number, options?: Record<string, unknown>) => Promise<TesseractWorker>;
    };

    const langPath = resolveLangPath();
    const cachePath = path.join(os.tmpdir(), "shiftsync-ocr-cache");
    fs.mkdirSync(cachePath, { recursive: true });

    const worker = await createWorker("eng", 1, {
      ...(langPath ? { langPath } : {}),
      cachePath,
      gzip: true,
      logger: () => undefined,
    });

    // 3 = fully automatic page segmentation; screenshots are multi-column.
    await worker.setParameters({ tessedit_pageseg_mode: "3", preserve_interword_spaces: "1" });

    return {
      recognize: async (buffer: Buffer) => {
        // Upscaling small captures and flattening colour measurably improves
        // accuracy on 10px UI text.
        const prepared = await sharp(buffer, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .greyscale()
          .normalise()
          .png()
          .toBuffer();
        const { data } = await worker.recognize(prepared);
        return cleanText(data.text || "", 6000);
      },
      close: async () => {
        await worker.terminate().catch(() => undefined);
      },
    };
  } catch (error) {
    console.warn(
      "OCR unavailable; screenshot narration will rely on vision only:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
};
