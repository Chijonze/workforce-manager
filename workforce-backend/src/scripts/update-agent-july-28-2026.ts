import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE || ".env" });

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import ShiftEvent from "../models/ShiftEvent";
import ShiftSession from "../models/ShiftSession";
import User from "../models/User";

/**
 * One-time update of the existing 28 July 2026 agent shift (UTC).
 * It deliberately requires exactly one existing session and replaces only its
 * event timeline and recorded KPI fields.
 */
const AGENT_EMAIL = "agent2@advancedvirtualsolutions.com";
const WORKED_MINUTES = 438;
const BREAK_MINUTES = 42;
const SCHEDULED_MINUTES = 456;
const dryRun = !process.argv.includes("--apply");

const atUtc = (hour: number, minute = 0) => new Date(Date.UTC(2026, 6, 28, hour, minute));
const startOfDay = atUtc(0);
const endOfDay = new Date(Date.UTC(2026, 6, 29));

async function main() {
  await connectDB();
  const agent = await User.findOne({ email: AGENT_EMAIL }).select("_id email role");
  if (!agent) throw new Error(`Agent not found: ${AGENT_EMAIL}`);
  if (agent.role !== "agent") throw new Error(`${AGENT_EMAIL} is not an agent account.`);

  const sessions = await ShiftSession.find({
    userId: agent._id.toString(),
    $or: [
      { scheduledStartTime: { $gte: startOfDay, $lt: endOfDay } },
      { clockInTime: { $gte: startOfDay, $lt: endOfDay } },
    ],
  });
  if (sessions.length !== 1) {
    throw new Error(`Expected exactly one existing shift on 2026-07-28; found ${sessions.length}. No changes were made.`);
  }

  const clockIn = atUtc(8);
  const breakStart = new Date(clockIn.getTime() + 219 * 60_000);
  const breakEnd = new Date(breakStart.getTime() + BREAK_MINUTES * 60_000);
  const clockOut = new Date(clockIn.getTime() + (WORKED_MINUTES + BREAK_MINUTES) * 60_000);
  const scheduledEnd = new Date(clockIn.getTime() + SCHEDULED_MINUTES * 60_000);
  const shift = sessions[0];

  if (dryRun) {
    console.log(`Would update shift ${shift._id} for 2026-07-28 and replace its event timeline with 438 worked minutes, 42 break minutes, on-time attendance, 100% adherence, and 98% KPI.`);
    return;
  }

  const previousEvents = await ShiftEvent.find({
    shiftId: shift._id,
    userId: agent._id.toString(),
  }).select("type timestamp metadata").lean();
  try {
    // This removes only events belonging to the single verified July 28 session.
    await ShiftEvent.deleteMany({ shiftId: shift._id, userId: agent._id.toString() });
    await ShiftEvent.insertMany([
      { shiftId: shift._id, userId: agent._id.toString(), type: "SHIFT_START", timestamp: clockIn, metadata: { scheduled: true } },
      { shiftId: shift._id, userId: agent._id.toString(), type: "BREAK_START", timestamp: breakStart, metadata: { breakLabel: "Break" } },
      { shiftId: shift._id, userId: agent._id.toString(), type: "BREAK_END", timestamp: breakEnd, metadata: { breakLabel: "Break" } },
      { shiftId: shift._id, userId: agent._id.toString(), type: "SHIFT_END", timestamp: clockOut },
    ]);
    await ShiftSession.updateOne({ _id: shift._id }, {
      $set: {
        clockInTime: clockIn,
        clockOutTime: clockOut,
        scheduledStartTime: clockIn,
        scheduledEndTime: scheduledEnd,
        status: "completed",
        attendanceStatus: "on_time",
        closureReason: "manual",
        autoClosed: false,
        totalWorkedMinutes: WORKED_MINUTES,
        totalBreakMinutes: BREAK_MINUTES,
        lateMinutes: 0,
        overtimeMinutes: 0,
        scheduledMinutes: SCHEDULED_MINUTES,
        workScore: 96,
        punctualityScore: 100,
        adherenceScore: 100,
        activityAdherenceScore: 100,
        kpiScore: 98,
        kpiEvaluatedAt: clockOut,
      },
    });
  } catch (error) {
    // Restore the verified session's original event timeline if replacement fails.
    await ShiftEvent.deleteMany({ shiftId: shift._id, userId: agent._id.toString() });
    if (previousEvents.length) {
      await ShiftEvent.insertMany(previousEvents.map((event) => ({
        shiftId: shift._id,
        userId: agent._id.toString(),
        type: event.type,
        timestamp: event.timestamp,
        metadata: event.metadata,
      })));
    }
    throw error;
  }

  console.log("Update complete: 2026-07-28 shift metrics and event timeline replaced.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });
