/**
 * Single pacing gate for every Gemini request the backend makes.
 *
 * The free tier enforces a low requests-per-minute ceiling, so analysis calls
 * and screenshot-narration calls must share one queue instead of each keeping
 * its own timer (which is what used to happen: two independent pacers would
 * double the actual request rate).
 */
const DEFAULT_SPACING_MS = 6_500;

let nextSlot = 0;

const spacingMs = () => {
  const configured = Number(process.env.GEMINI_CALL_SPACING_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_SPACING_MS;
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reserves the next slot in the shared queue and waits for it. Callers should
 * acquire immediately before the network request, not before local work, so a
 * slow montage/OCR pass does not idle the quota.
 */
export const acquireGeminiSlot = async () => {
  const spacing = spacingMs();
  if (spacing === 0) return;

  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + spacing;
  if (wait > 0) await sleep(wait);
};

/** Test hook: forget the reservation cursor. */
export const resetGeminiPacing = () => {
  nextSlot = 0;
};
