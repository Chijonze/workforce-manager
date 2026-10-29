/**
 * Backfills screen narration for concluded shifts that have screenshots but no
 * narration yet. Safe to run repeatedly: shifts already narrated are skipped
 * unless --force is passed.
 *
 * Usage (on the server, where the capture files live):
 *   npx ts-node --transpile-only src/scripts/narrate-shifts.ts --limit 5
 *   npx ts-node --transpile-only src/scripts/narrate-shifts.ts --shift <shiftId> --force
 *   npx ts-node --transpile-only src/scripts/narrate-shifts.ts --dry
 */
import "dotenv/config";
import mongoose from "mongoose";

import ActivityNarration from "../models/ActivityNarration";
import MonitoringSession from "../models/MonitoringSession";
import ShiftSession from "../models/ShiftSession";
import { generateActivityNarration } from "../modules/vision/activityNarration.service";
import { visionConfig } from "../modules/vision/vision.config";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const shiftId = flag("--shift");
const limit = Math.max(1, Number(flag("--limit")) || 5);
const force = args.includes("--force");
const dry = args.includes("--dry");

const main = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing");

  await mongoose.connect(uri);
  console.log(`Connected. Model: ${visionConfig.model}, OCR mode: ${visionConfig.ocrMode}`);

  const sessions = shiftId
    ? await MonitoringSession.find({ shiftSessionId: shiftId }).lean()
    : await MonitoringSession.find({ "captures.0": { $exists: true } })
        .sort({ startedAt: -1 })
        .limit(limit * 4)
        .lean();

  const candidates = [];
  for (const session of sessions) {
    const shift = await ShiftSession.findById(session.shiftSessionId)
      .select("userId status attendanceStatus clockInTime scheduledStartTime")
      .lean();
    if (!shift) continue;
    if (shift.attendanceStatus === "absent") continue;

    const existing = await ActivityNarration.findOne({
      shiftSessionId: session.shiftSessionId,
    })
      .select("status")
      .lean();

    if (existing && existing.status === "completed" && !force) continue;
    candidates.push({ session, shift, existing });
    if (candidates.length >= limit) break;
  }

  if (!candidates.length) {
    console.log("Nothing to narrate — every matching shift already has narration.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Shifts to narrate: ${candidates.length}`);
  for (const candidate of candidates) {
    const label = `${candidate.shift._id} (${candidate.session.captures.length} captures)`;
    if (dry) {
      console.log(`  would narrate ${label}`);
      continue;
    }

    console.log(`\n→ ${label}`);
    try {
      const narration = await generateActivityNarration(String(candidate.shift._id), { force });
      console.log(
        `  status=${narration.status} blocks=${narration.blocks.length} ` +
          `visionCalls=${narration.coverage.visionCalls} dupes=${narration.coverage.duplicatesSkipped} ` +
          `blank=${narration.coverage.blankFrames} source=${narration.source}`
      );
      for (const block of narration.blocks) {
        console.log(`  [${block.startedAt.toISOString().slice(11, 16)}] ${block.summary}`);
      }
    } catch (error) {
      console.error(`  failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
