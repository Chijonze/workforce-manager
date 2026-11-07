/**
 * Optional pacing gate for every model request the backend makes.
 *
 * The provider allows a high concurrency, so the default spacing is zero. The
 * gate still exists for two reasons: it serialises bursts from the analysis
 * backfill sweep, and it gives operators a single knob (`AI_CALL_SPACING_MS`)
 * when a deployment hits throttling.
 */
const DEFAULT_SPACING_MS = 0;

let nextSlot = 0;

const spacingMs = () => {
  const configured = Number(process.env.AI_CALL_SPACING_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_SPACING_MS;
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reserves the next slot in the shared queue and waits for it. Callers should
 * acquire immediately before the network request, not before local work, so a
 * slow OCR/montage pass does not idle the queue.
 */
export const acquireAiSlot = async () => {
  const spacing = spacingMs();
  if (spacing === 0) return;

  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + spacing;
  if (wait > 0) await sleep(wait);
};

/** Test hook: forget the reservation cursor. */
export const resetAiPacing = () => {
  nextSlot = 0;
};
