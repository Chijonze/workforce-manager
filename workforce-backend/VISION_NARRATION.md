# Screenshot narration (Gemini vision)

Turns the periodic monitoring screenshots a shift already captures into a
concrete account of **what the worker actually did on screen**, and feeds that
evidence into the AI Analysis narrative. Before this, screenshots were only
counted — `analysis.service.ts` never sent an image to the model, so summaries
described mouse telemetry rather than work.

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
buildMontage       one labelled contact sheet per block (2 columns, 640px tiles)
        │
        ▼
narrateBlock       router: Gemini vision → Gemini text (OCR) → local OCR excerpt
        │
        ▼
persist            ActivityNarration (one doc per shift, cached)
        │
        ▼
shift analysis     screenActivity in the prompt; blocks copied onto ShiftAnalysis
```

Blank/locked frames never reach the model: they become deterministic `idle`
blocks ("screen locked or blank across N captures"), so the day's narrative has
no silent gaps and costs no quota.

## Files

| File | Role |
| --- | --- |
| `src/models/ActivityNarration.ts` | Per-shift narration + per-block evidence |
| `src/modules/vision/imagePrep.ts` | Hashing, dedupe, blank detection, blocking |
| `src/modules/vision/ocr.ts` | Tesseract worker (bundled `eng` traineddata) |
| `src/modules/vision/montage.ts` | Contact-sheet renderer |
| `src/modules/vision/prompt.ts` | System prompt, JSON contract, sanitiser |
| `src/modules/vision/router.ts` | Provider ladder + retries + quota cooldown |
| `src/modules/vision/activityNarration.service.ts` | Orchestration + persistence |
| `src/scripts/narrate-shifts.ts` | Backfill CLI for existing shifts |
| `src/scripts/vision-smoke.ts` | Synthetic end-to-end demo (no DB needed) |

## API

Admin/supervisor auth, same scope rules as the rest of analysis:

- `GET  /api/analysis/shift/:shiftId/activity` — cached narration, 404 if none
- `POST /api/analysis/shift/:shiftId/activity` — generate; body `{ "force": true }`

The saved analysis response now also carries `screenActivity` (overview, blocks
with confidence ≥ 40, coverage). Low-confidence OCR excerpts are deliberately
excluded from reports; they remain visible on the activity endpoint.

Automatic path: `enqueueShiftAnalysis` narrates first (no time budget), then
generates the report. Manual `POST /shift/:id/generate` attempts narration with
`VISION_INLINE_BUDGET_MS` (60s default) and proceeds without it if the budget
runs out.

## Configuration

Every knob is an env var; see `.env.example` and `docker-compose.prod.yml`.

| Var | Default | Notes |
| --- | --- | --- |
| `VISION_ENABLED` | `true` | master switch |
| `GEMINI_VISION_MODEL` | `gemini-2.5-flash` | `gemini-3.5-flash-lite` also worked in testing |
| `VISION_BLOCK_FRAMES` | `6` | frames per model call |
| `VISION_MAX_BLOCKS` | `8` | hard cap on calls per shift |
| `VISION_TILE_WIDTH` | `640` | montage tile width |
| `VISION_DEDUPE_DISTANCE` | `5` | 0–64 Hamming; raise to collapse more |
| `VISION_OCR_MODE` | `fallback` | `always` = OCR before vision (slower, better app names) |
| `VISION_INLINE_BUDGET_MS` | `60000` | inline request ceiling |
| `GEMINI_CALL_SPACING_MS` | `6500` | shared pacing for all Gemini calls |

## Cost model

An 8-hour shift captures 32 frames. Dedupe typically removes 40–60%, leaving
~15–20 unique frames → **3–4 vision calls**, each ~750 prompt tokens and ~50 KB
of JPEG. Narration is persisted, so regenerating an analysis costs zero extra
vision calls.

## Privacy rules baked in

- The vision prompt forbids transcribing customer names, emails, phones and card
  numbers, and requires flagging visible credentials instead of reproducing them.
- `vision.redact.ts` mechanically masks emails and long digit runs before OCR
  text is sent to any model.
- The analysis prompt repeats the no-PII rule for anything derived from
  `screenActivity`.
- Capture images are read from disk and sent inline; nothing is uploaded to a
  third party beyond the Gemini call itself.

## Running it

```bash
# No database needed — renders synthetic screenshots and prints narration
npx ts-node --transpile-only src/scripts/vision-smoke.ts
npx ts-node --transpile-only src/scripts/vision-smoke.ts --ocr   # OCR fallback path

# Backfill real shifts (run where the capture files live)
npx ts-node --transpile-only src/scripts/narrate-shifts.ts --limit 5
npx ts-node --transpile-only src/scripts/narrate-shifts.ts --shift <shiftId> --force
```

## Known limits

- One worker's screen only; multi-monitor captures are treated as one frame.
- Contact-sheet text at 640px is readable but small; raise `VISION_TILE_WIDTH`
  to 800–960 if accuracy on dense UIs matters more than quota.
- Blank detection is a contrast heuristic; a nearly uniform dark IDE could be
  misread as idle.
- `screenActivity` is exposed by the API but not yet rendered in the frontend.
- Retention of `ActivityNarration` follows the shift's own data lifecycle; there
  is no separate TTL index.
