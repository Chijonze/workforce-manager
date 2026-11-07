/**
 * One-off migration for records written before the analysis engine was
 * abstracted behind a single internal source tag.
 *
 * It does two things:
 *   1. Normalises `source` values to the current vocabulary (`ai` / `fallback` /
 *      `ocr` / `deterministic` / `none`) so old reports stay readable.
 *   2. Clears stored model names, which must not travel with a report.
 *
 * Usage (safe by default — it only reports unless --apply is passed):
 *   npx ts-node --transpile-only src/scripts/migrate-ai-records.ts
 *   npx ts-node --transpile-only src/scripts/migrate-ai-records.ts --apply
 */
import "dotenv/config";
import mongoose from "mongoose";

import ActivityNarration from "../models/ActivityNarration";
import AiQuotaState from "../models/AiQuotaState";
import PeriodAnalysis from "../models/PeriodAnalysis";
import ShiftAnalysis from "../models/ShiftAnalysis";
import { aiConfig } from "../modules/ai/ai.config";

const apply = process.argv.includes("--apply");
const sourceValues = ["ai", "fallback"];
const narrationSources = ["ai", "ocr", "deterministic"];
const reportSources = ["ai", "ocr", "none"];

const summary: Record<string, number> = {};

const migrate = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing");

  await mongoose.connect(uri);
  console.log(`Connected. ${apply ? "Applying changes." : "Dry run — pass --apply to write."}`);

  summary.shiftSource = await ShiftAnalysis.countDocuments({ source: { $nin: sourceValues } });
  summary.periodSource = await PeriodAnalysis.countDocuments({ source: { $nin: sourceValues } });
  summary.narrationSource = await ActivityNarration.countDocuments({
    source: { $nin: reportSources },
  });
  summary.narrationBlocks = await ActivityNarration.countDocuments({
    "blocks.source": { $nin: narrationSources },
  });
  summary.shiftModel = await ShiftAnalysis.countDocuments({
    aiModel: { $nin: ["", aiConfig.analysisModel, aiConfig.visionModel] },
  });
  summary.periodModel = await PeriodAnalysis.countDocuments({
    aiModel: { $nin: ["", aiConfig.analysisModel, aiConfig.visionModel] },
  });
  summary.narrationModel = await ActivityNarration.countDocuments({
    aiModel: { $nin: ["", aiConfig.analysisModel, aiConfig.visionModel] },
  });
  summary.legacyQuotaDocs = await AiQuotaState.countDocuments({ scope: { $ne: "ai" } });

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("Nothing written. Re-run with --apply to migrate.");
    await mongoose.disconnect();
    return;
  }

  await ShiftAnalysis.updateMany(
    { source: { $nin: sourceValues } },
    { $set: { source: "ai" } }
  );
  await PeriodAnalysis.updateMany(
    { source: { $nin: sourceValues } },
    { $set: { source: "ai" } }
  );
  await ActivityNarration.updateMany(
    { source: { $nin: reportSources } },
    { $set: { source: "ai" } }
  );

  if (summary.narrationBlocks) {
    await ActivityNarration.updateMany({ "blocks.source": { $nin: narrationSources } }, [
      {
        $set: {
          blocks: {
            $map: {
              input: "$blocks",
              as: "block",
              in: {
                $mergeObjects: [
                  "$$block",
                  {
                    source: {
                      $cond: [
                        { $in: ["$$block.source", narrationSources] },
                        "$$block.source",
                        "ai",
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ] as any);
  }

  const clearModel = { $set: { aiModel: "" } };
  await ShiftAnalysis.updateMany(
    { aiModel: { $nin: ["", aiConfig.analysisModel, aiConfig.visionModel] } },
    clearModel
  );
  await PeriodAnalysis.updateMany(
    { aiModel: { $nin: ["", aiConfig.analysisModel, aiConfig.visionModel] } },
    clearModel
  );
  await ActivityNarration.updateMany(
    { aiModel: { $nin: ["", aiConfig.analysisModel, aiConfig.visionModel] } },
    clearModel
  );

  if (summary.legacyQuotaDocs) {
    await AiQuotaState.deleteMany({ scope: { $ne: "ai" } });
  }

  console.log("Migration applied.");
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
