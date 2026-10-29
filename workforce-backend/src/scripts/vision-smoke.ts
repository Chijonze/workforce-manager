/**
 * End-to-end smoke test for the screenshot-narration pipeline.
 *
 * Renders a handful of synthetic "screenshots" that mimic a support agent's
 * desktop (including a deliberate duplicate and a locked screen), then runs:
 *   prepareFrames → dedupe → blocks → montage → Gemini vision → narration.
 *
 * Usage: npx ts-node --transpile-only src/scripts/vision-smoke.ts
 * Artefacts are written to tmp/vision-demo/ (montage + per-block JSON).
 */
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import "dotenv/config";

import {
  groupIntoBlocks,
  prepareFrames,
  type CaptureLike,
} from "../modules/vision/imagePrep";
import { buildMontage } from "../modules/vision/montage";
import { createOcrSession } from "../modules/vision/ocr";
import { narrateBlock } from "../modules/vision/router";
import { visionConfig } from "../modules/vision/vision.config";

const OUT_DIR = path.join(process.cwd(), "tmp", "vision-demo");

const frame = (width: number, height: number, body: string) => Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
);

const line = (
  text: string,
  x: number,
  y: number,
  options: { size?: number; color?: string; weight?: string } = {}
) =>
  `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${
    options.size || 18
  }" fill="${options.color || "#1f2937"}" font-weight="${options.weight || "normal"}">${text}</text>`;

const chrome = (title: string, url: string, content: string) =>
  frame(
    1600,
    900,
    `<rect width="1600" height="900" fill="#ffffff"/>
     <rect width="1600" height="72" fill="#f1f5f9"/>
     <circle cx="34" cy="36" r="8" fill="#ef4444"/><circle cx="62" cy="36" r="8" fill="#f59e0b"/><circle cx="90" cy="36" r="8" fill="#22c55e"/>
     <rect x="130" y="16" width="900" height="40" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
     ${line(url, 148, 43, { size: 16, color: "#64748b" })}
     ${line(title, 40, 116, { size: 26, weight: "600" })}
     ${content}`
  );

const screens: { name: string; at: string; svg: Buffer }[] = [
  {
    name: "zendesk-ticket",
    at: "2026-10-28T09:00:00+01:00",
    svg: chrome(
      "Ticket #48213 — Refund not received",
      "acme.zendesk.com/agent/tickets/48213",
      `<rect x="40" y="150" width="1000" height="640" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
       ${line("Requester", 70, 190, { size: 15, color: "#64748b" })}
       ${line("Amara Okafor · amara.okafor@example.com · Order #A-77421", 70, 218)}
       ${line("Status: Open · Priority: High · Assignee: Daniel E.", 70, 252, { size: 16, color: "#475569" })}
       ${line("Customer message", 70, 306, { size: 15, color: "#64748b" })}
       ${line("I was refunded on the 12th but my bank still shows nothing. Please advise.", 70, 338, { size: 17 })}
       ${line("Internal note", 70, 396, { size: 15, color: "#64748b" })}
       ${line("Refund batch 8841 settled 14 Oct. Checking acquirer report.", 70, 428, { size: 17, color: "#334155" })}
       <rect x="70" y="490" width="930" height="210" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
       ${line("Reply to customer…", 92, 530, { size: 18, color: "#0f172a" })}
       ${line("Hi Amara, I have traced your refund to batch 8841 which settled on", 92, 574, { size: 17, color: "#334155" })}
       ${line("14 October. Your bank typically posts it within 3 working days, so it", 92, 604, { size: 17, color: "#334155" })}
       ${line("should appear by Thursday. I will keep the ticket open until it does.", 92, 634, { size: 17, color: "#334155" })}
       <rect x="70" y="730" width="190" height="46" rx="8" fill="#2563eb"/>
       ${line("Submit as Solved", 96, 760, { size: 17, color: "#ffffff" })}`
    ),
  },
  {
    name: "zendesk-ticket-duplicate",
    at: "2026-10-28T09:15:00+01:00",
    svg: chrome(
      "Ticket #48213 — Refund not received",
      "acme.zendesk.com/agent/tickets/48213",
      `<rect x="40" y="150" width="1000" height="640" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
       ${line("Requester", 70, 190, { size: 15, color: "#64748b" })}
       ${line("Amara Okafor · amara.okafor@example.com · Order #A-77421", 70, 218)}
       ${line("Status: Open · Priority: High · Assignee: Daniel E.", 70, 252, { size: 16, color: "#475569" })}
       ${line("Customer message", 70, 306, { size: 15, color: "#64748b" })}
       ${line("I was refunded on the 12th but my bank still shows nothing. Please advise.", 70, 338, { size: 17 })}
       ${line("Internal note", 70, 396, { size: 15, color: "#64748b" })}
       ${line("Refund batch 8841 settled 14 Oct. Checking acquirer report.", 70, 428, { size: 17, color: "#334155" })}
       <rect x="70" y="490" width="930" height="210" rx="8" fill="#ffffff" stroke="#cbd5e1"/>
       ${line("Reply to customer…", 92, 530, { size: 18, color: "#0f172a" })}
       ${line("Hi Amara, I have traced your refund to batch 8841 which settled on", 92, 574, { size: 17, color: "#334155" })}
       ${line("14 October. Your bank typically posts it within 3 working days, so it", 92, 604, { size: 17, color: "#334155" })}
       ${line("should appear by Thursday. I will keep the ticket open until it does.", 92, 634, { size: 17, color: "#334155" })}
       <rect x="70" y="730" width="190" height="46" rx="8" fill="#2563eb"/>
       ${line("Submit as Solved", 96, 760, { size: 17, color: "#ffffff" })}`
    ),
  },
  {
    name: "sheets-roster",
    at: "2026-10-28T09:30:00+01:00",
    svg: chrome(
      "Shift roster — October 2026",
      "docs.google.com/spreadsheets/d/1RoSter",
      `<rect x="40" y="150" width="1200" height="520" fill="#ffffff" stroke="#cbd5e1"/>
       <rect x="40" y="150" width="1200" height="46" fill="#e2e8f0"/>
       ${line("Agent", 60, 180, { size: 16, weight: "600" })}
       ${line("Mon 27", 340, 180, { size: 16, weight: "600" })}
       ${line("Tue 28", 500, 180, { size: 16, weight: "600" })}
       ${line("Wed 29", 660, 180, { size: 16, weight: "600" })}
       ${line("Thu 30", 820, 180, { size: 16, weight: "600" })}
       ${line("Fri 31", 980, 180, { size: 16, weight: "600" })}
       ${["Daniel E.|08:00–16:00|08:00–16:00|OFF|08:00–16:00|08:00–16:00",
          "Grace A.|16:00–00:00|16:00–00:00|16:00–00:00|OFF|16:00–00:00",
          "Ibrahim S.|OFF|08:00–16:00|08:00–16:00|08:00–16:00|08:00–16:00",
          "Ngozi O.|12:00–20:00|12:00–20:00|12:00–20:00|12:00–20:00|12:00–20:00"]
         .map((row, index) => {
           const cells = row.split("|");
           return cells
             .map((cell, column) =>
               line(cell, column === 0 ? 60 : 340 + (column - 1) * 160, 232 + index * 52, {
                 size: 16,
                 color: column === 0 ? "#0f172a" : "#334155",
               })
             )
             .join("");
         })
         .join("")}
       <rect x="40" y="440" width="1200" height="1" fill="#cbd5e1"/>
       ${line("Coverage check: Tue 28 needs 5 agents, 4 scheduled", 60, 500, { size: 17, color: "#b91c1c" })}
       ${line("Cell F7", 60, 540, { size: 15, color: "#64748b" })}`
    ),
  },
  {
    name: "slack-escalation",
    at: "2026-10-28T09:45:00+01:00",
    svg: chrome(
      "Slack — #support-escalations",
      "app.slack.com/client/T0241/C8842",
      `<rect x="0" y="130" width="300" height="770" fill="#3f0e40"/>
       ${line("# support-escalations", 24, 180, { size: 19, color: "#ffffff", weight: "600" })}
       ${line("# support-triage", 24, 220, { size: 17, color: "#c4b5c6" })}
       ${line("# refunds", 24, 258, { size: 17, color: "#c4b5c6" })}
       ${line("# team-leads", 24, 296, { size: 17, color: "#c4b5c6" })}
       ${line("Priya Menon  09:41", 340, 190, { size: 16, color: "#475569" })}
       ${line("Acquirer confirmed batch 8841 settled. Two more tickets from the same batch.", 340, 220, { size: 18 })}
       ${line("Daniel E.  09:43", 340, 270, { size: 16, color: "#475569" })}
       ${line("Picking those up now — 48213 replied, 48219 next.", 340, 300, { size: 18 })}
       ${line("Priya Menon  09:44", 340, 350, { size: 16, color: "#475569" })}
       ${line("Thanks. Flag any that need a bank letter.", 340, 380, { size: 18 })}`
    ),
  },
  {
    name: "locked-screen",
    at: "2026-10-28T10:00:00+01:00",
    svg: frame(1600, 900, `<rect width="1600" height="900" fill="#0b0f14"/>`),
  },
  {
    name: "gmail-inbox",
    at: "2026-10-28T10:15:00+01:00",
    svg: chrome(
      "Inbox (12)",
      "mail.google.com/mail/u/0/#inbox",
      `<rect x="0" y="130" width="360" height="770" fill="#f8fafc" stroke="#e2e8f0"/>
       ${line("Inbox 12", 24, 180, { size: 18, weight: "600" })}
       ${line("Starred", 24, 220, { size: 17, color: "#475569" })}
       ${line("Snoozed", 24, 258, { size: 17, color: "#475569" })}
       ${line("Sent", 24, 296, { size: 17, color: "#475569" })}
       ${line("Acquirer report — batch 8841", 400, 190, { size: 18, weight: "600" })}
       ${line("settlements@acquirer.example  10:12", 400, 220, { size: 15, color: "#64748b" })}
       ${line("Please find attached the settlement report for 14 October.", 400, 252, { size: 17 })}
       ${line("Payroll query — October cycle", 400, 320, { size: 18, weight: "600" })}
       ${line("finance@acme.example  09:58", 400, 350, { size: 15, color: "#64748b" })}
       ${line("Timesheets for week 43 are missing for two agents.", 400, 382, { size: 17 })}`
    ),
  },
];

const main = async () => {
  const ocrOnly = process.argv.includes("--ocr");
  await fs.mkdir(OUT_DIR, { recursive: true });

  const captures: CaptureLike[] = [];
  for (let index = 0; index < screens.length; index += 1) {
    const screen = screens[index];
    const filePath = path.join(OUT_DIR, `${index + 1}-${screen.name}.webp`);
    await sharp(screen.svg).resize(1600, 900).webp({ quality: 82 }).toFile(filePath);
    captures.push({ seq: index + 1, capturedAt: new Date(screen.at), filePath });
  }

  console.log(`\nRendered ${captures.length} synthetic captures into ${OUT_DIR}`);

  const prepared = await prepareFrames(captures, {
    dedupeDistance: visionConfig.dedupeDistance,
    maxCaptures: visionConfig.maxCaptures,
  });

  console.log(
    `Dedupe: ${prepared.frames.length} read → ${prepared.kept.length} unique | ` +
      `${prepared.duplicatesSkipped} duplicate(s) | ${prepared.blankFrames} blank | ${prepared.missingFiles} missing`
  );

  const blocks = groupIntoBlocks(prepared.kept, 3);
  console.log(`Blocks: ${blocks.length} (model: ${visionConfig.model})\n`);

  const ocrSession = ocrOnly ? await createOcrSession() : null;
  if (ocrOnly && !ocrSession) throw new Error("OCR session unavailable");

  for (const block of blocks) {
    const montage = await buildMontage(block.frames, { tileWidth: visionConfig.tileWidth });
    if (!montage) continue;

    const montagePath = path.join(OUT_DIR, `montage-${block.index + 1}.jpg`);
    await fs.writeFile(montagePath, montage.buffer);

    let ocrText = "";
    if (ocrSession) {
      const started = Date.now();
      for (const frame of block.frames) {
        ocrText += `${await ocrSession.recognize(await fs.readFile(frame.filePath))}\n---\n`;
      }
      console.log(`OCR block ${block.index + 1}: ${ocrText.length} chars in ${Date.now() - started}ms`);
    }

    const routed = await narrateBlock({
      block,
      montage: ocrOnly ? null : montage.buffer,
      ocrText,
      ocrChars: ocrText.length,
      skipVision: ocrOnly,
    });

    const result = {
      block: block.index + 1,
      frames: block.frames.map((item) => item.seq),
      montage: montagePath,
      imageKb: Math.round(montage.buffer.length / 1024),
      provider: routed.source,
      ocrChars: ocrText.length,
      tokens: { prompt: routed.promptTokens, output: routed.outputTokens },
      latencyMs: routed.latencyMs,
      ...routed.narration,
    };
    await fs.writeFile(
      path.join(OUT_DIR, `narration-${block.index + 1}.json`),
      JSON.stringify(result, null, 2)
    );
    console.log(JSON.stringify(result, null, 2));
  }

  await ocrSession?.close();
  console.log(`\nIdle/blank captures (narrated without a model call): ${prepared.blankFrames}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
