# Screenshot narration and the analysis engine

Turns the periodic monitoring screenshots a shift already captures into a
concrete account of **what the worker actually did on screen**, and feeds that
evidence into the AI Analysis & Summary report. Before this, screenshots were
only counted — summaries described mouse telemetry rather than work.

Reports are branded as **ShiftSync AI**. The vendor and model names are internal
operations data and are never returned by the API.

## Pipeline

```
MonitoringSession.captures (15-min cadence, up to 96)
        │
        ▼
prepareFrames      read once · 64-bit dHash · blank-screen flag
        │           duplicates compared against the last 3 kept frames
        ▼
sampleFrames       evenly down-sample to maxBlocks × blockFrames
        │
        ▼
groupIntoBlocks    chronological, N unique frames per block (default 6)
        │
        ▼
buildMontage       one labelled contact sheet per block (2 columns, 720px tiles)
        │
        ▼
ocr (Tesseract)    optional transcript of the same frames
        │
        ▼
narrateBlock       multimodal model reads the contact sheet (and the OCR text)
        │           fallback: text-only narration from the OCR transcript
        │           last resort: deterministic OCR excerpt
        ▼
persist            ActivityNarration (one doc per shift, cached)
        │
        ▼
shift analysis     screenEvidence in the prompt; blocks copied onto ShiftAnalysis
        │
        ▼
period analysis    chronological story beats + screenshots embedded in the PDF
```

Blank/locked frames never reach the model: they become deterministic `idle`
blocks ("screen locked or blank across N captures"), so the day's narrative has
no silent gaps and costs no model call.

## Why OCR still runs

The narration model is multimodal, and it is good at reading screenshots. Local
OCR is kept because it gives the model a second, independent reading of the same
window: exact application names, document titles, ticket ids and menu labels that
pixel-level reading sometimes smudges. Both readings are sent in one request, so
the model can cross-check them. `VISION_OCR_MODE=always` (the default) enables
this on every block; `fallback` and `off` are still available.

## Files

| File | Role |
| --- | --- |
| `src/models/ActivityNarration.ts` | Per-shift narration + per-block evidence |
| `src/modules/vision/imagePrep.ts` | Hashing, dedupe, blank detection, blocking |
| `src/modules/vision/ocr.ts` | Tesseract worker (bundled `eng` traineddata) |
| `src/modules/vision/montage.ts` | Contact-sheet renderer |
| `src/modules/vision/prompt.ts` | System prompt, JSON contract, sanitiser |
| `src/modules/vision/router.ts` | Provider ladder (multimodal → OCR text → local) |
| `src/modules/vision/activityNarration.service.ts` | Orchestration + persistence |
| `src/modules/ai/ai.client.ts` | The single JSON call used by every report |
| `src/modules/ai/ai.config.ts` | Provider/model/token/timeout configuration |
| `src/modules/ai/quota.service.ts` | Throttle pauses + daily retry budget |
| `src/modules/analysis/analysis.metrics.ts` | Deterministic derived analytics |
| `src/modules/analysis/analysis.prompts.ts` | Long-form contracts, sanitisers, fallbacks |
| `src/scripts/narrate-shifts.ts` | Backfill CLI for existing shifts |
| `src/scripts/vision-smoke.ts` | Synthetic end-to-end demo (no DB needed) |
| `src/scripts/migrate-ai-records.ts` | One-off normalisation of legacy records |

## API

Admin/supervisor auth, same scope rules as the rest of analysis:

- `GET  /api/analysis/shift/:shiftId/activity` — cached narration, 404 if none
- `POST /api/analysis/shift/:shiftId/activity` — generate; body `{ "force": true }`
- `GET  /api/analysis/aggregate?startDate&endDate[&userId]` — totals, per-worker
  rows, period analytics, screenshot story beats and capture references
- `POST /api/analysis/aggregate/narrative` — generate the long-form period report

The saved analysis carries `screenActivity` (overview, per-window blocks,
coverage) and each block stores the id of the screenshot nearest to its window so
the PDF can pair the narration with the image.

Automatic path: `enqueueShiftAnalysis` narrates first (no time budget), then
generates the report. Manual `POST /shift/:id/generate` attempts narration with
`VISION_INLINE_BUDGET_MS` (90s default) and proceeds without it if the budget
runs out.

## Configuration

Every knob is an env var; see `.env.example` and `docker-compose.prod.yml`.

| Var | Default | Notes |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | *(empty)* | empty = deterministic reports only |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible endpoint |
| `AI_ANALYSIS_MODEL` | `deepseek-flash` | lightweight multimodal model |
| `AI_VISION_MODEL` | `deepseek-flash` | model used for screenshot narration |
| `AI_ANALYSIS_MAX_TOKENS` | `7000` | per-shift report budget |
| `AI_AGGREGATE_MAX_TOKENS` | `9000` | period report budget |
| `AI_NARRATION_MAX_TOKENS` | `1400` | per screenshot block |
| `AI_THINKING` | `off` | `off` / `auto` (period reports only) / `on` |
| `AI_CALL_SPACING_MS` | `0` | optional pacing between calls |
| `AI_ANALYSIS_TIMEOUT_MS` | `180000` | per-shift request ceiling |
| `AI_AGGREGATE_TIMEOUT_MS` | `300000` | period report ceiling |
| `VISION_ENABLED` | `true` | master switch |
| `VISION_BLOCK_FRAMES` | `6` | frames per model call |
| `VISION_MAX_BLOCKS` | `8` | hard cap on calls per shift |
| `VISION_TILE_WIDTH` | `720` | montage tile width |
| `VISION_DEDUPE_DISTANCE` | `5` | 0–64 Hamming; raise to collapse more |
| `VISION_OCR_MODE` | `always` | OCR every block and send it with the images |
| `VISION_INLINE_BUDGET_MS` | `90000` | inline request ceiling |

## Cost model

An 8-hour shift captures 32 frames. Dedupe typically removes 40–60%, leaving
~15–20 unique frames → **3–4 narration calls**, each a ~50 KB contact sheet.
Narration is persisted, so regenerating an analysis costs zero extra narration
calls.

A shift report is one call with ~3–6K prompt tokens and up to 7K output tokens.
A period report adds the shift log and the screenshot story: ~10–20K prompt
tokens and up to 9K output tokens. Both are small at current provider pricing and
do not scale with the number of screenshots stored.

## Privacy rules baked in

- The narration prompt forbids transcribing customer names, emails, phones and
  card numbers, and requires flagging visible credentials instead of reproducing
  them.
- `vision.redact.ts` mechanically masks emails and long digit runs before OCR
  text is sent to any model.
- The report prompts repeat the no-PII rule for anything derived from screen
  evidence.
- Capture images are read from disk and sent inline to the configured provider;
  nothing is uploaded anywhere else.

## Running it

```bash
# No database needed — renders synthetic screenshots and prints narration
npx ts-node --transpile-only src/scripts/vision-smoke.ts
npx ts-node --transpile-only src/scripts/vision-smoke.ts --ocr   # OCR path

# Backfill real shifts (run where the capture files live)
npx ts-node --transpile-only src/scripts/narrate-shifts.ts --limit 5
npx ts-node --transpile-only src/scripts/narrate-shifts.ts --shift <shiftId> --force

# One-off: normalise legacy records and drop stored model names
npx ts-node --transpile-only src/scripts/migrate-ai-records.ts --apply
```

## Throttling and retries

The hosted provider allows a high concurrency, so the default pacing is zero.
When a `429` does happen:

1. `quota.service` reads the retry window from the `Retry-After` header or the
   error body and persists a short pause in `aiquotastates`.
2. Every later call — narration or report — waits out that pause instead of
   hammering the provider.
3. `narrationRetry.service` runs on an interval (15 min default). While paused it
   does nothing. Once the window passes it narrates one pending shift at a time,
   up to `VISION_RETRY_MAX_SHIFTS_PER_DAY` per day, and regenerates the shift's
   analysis when it has no screen evidence or had fallen back to the offline
   report.
4. `GET /api/analysis/quota` reports the state (vendor and model omitted):

```json
{
  "quota": { "blocked": true, "pausedUntil": "2026-11-07T10:12:00.000Z",
             "attemptsToday": 0 },
  "pendingNarrations": 8,
  "retry": { "enabled": true, "intervalMs": 900000, "maxShiftsPerDay": 12 }
}
```

YAML-free knobs: `VISION_RETRY_ENABLED`, `VISION_RETRY_INTERVAL_MS`,
`VISION_RETRY_MAX_SHIFTS_PER_DAY`, `VISION_RETRY_LOOKBACK_DAYS`.

## Known limits

- One worker's screen only; multi-monitor captures are treated as one frame.
- Contact-sheet text at 720px is readable; raise `VISION_TILE_WIDTH` to 900–1024
  for very dense UIs.
- Blank detection is a contrast heuristic; a nearly uniform dark IDE could be
  misread as idle.
- Period reports narrate at most the 60 most recent shifts with screen evidence
  in the range (the metrics cover every analysed shift).
- Retention of `ActivityNarration` follows the shift's own data lifecycle; there
  is no separate TTL index.
