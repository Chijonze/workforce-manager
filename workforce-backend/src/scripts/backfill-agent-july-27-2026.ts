import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE || ".env" });

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import Schedule from "../models/schedule.model";
import ShiftEvent from "../models/ShiftEvent";
import ShiftSession from "../models/ShiftSession";
import User from "../models/User";

/** One-time, non-destructive backfill for 27 July 2026 (UTC). */
const AGENT_EMAIL = "agent2@advancedvirtualsolutions.com";
const WORKED_MINUTES = 438;
const BREAK_MINUTES = 42;
const SCHEDULED_MINUTES = 456;
const dryRun = !process.argv.includes("--apply");

const atUtc = (hour: number, minute = 0) => new Date(Date.UTC(2026, 6, 27, hour, minute));
const startOfDay = atUtc(0);
const endOfDay = new Date(Date.UTC(2026, 6, 28));
const sameInstant = (value: Date | undefined, expected: Date) => Boolean(value && value.getTime() === expected.getTime());

function expectedRecordMatches(session: any, clockIn: Date, scheduledEnd: Date, clockOut: Date) {
  return session.status === "completed" && session.attendanceStatus === "on_time" &&
    sameInstant(session.clockInTime, clockIn) && sameInstant(session.scheduledStartTime, clockIn) &&
    sameInstant(session.scheduledEndTime, scheduledEnd) && sameInstant(session.clockOutTime, clockOut) &&
    session.totalWorkedMinutes === WORKED_MINUTES && session.totalBreakMinutes === BREAK_MINUTES &&
    session.lateMinutes === 0 && session.overtimeMinutes === 0 && session.scheduledMinutes === SCHEDULED_MINUTES &&
    session.adherenceScore === 100 && session.activityAdherenceScore === 100 && session.workScore === 96 &&
    session.punctualityScore === 100 && session.kpiScore === 98;
}

async function main() {
  await connectDB();
  const agent = await User.findOne({ email: AGENT_EMAIL }).select("_id email role");
  if (!agent) throw new Error(`Agent not found: ${AGENT_EMAIL}`);
  if (agent.role !== "agent") throw new Error(`${AGENT_EMAIL} is not an agent account.`);

  const clockIn = atUtc(8);
  const breakStart = new Date(clockIn.getTime() + 219 * 60_000);
  const breakEnd = new Date(breakStart.getTime() + BREAK_MINUTES * 60_000);
  const clockOut = new Date(clockIn.getTime() + (WORKED_MINUTES + BREAK_MINUTES) * 60_000);
  const scheduledEnd = new Date(clockIn.getTime() + SCHEDULED_MINUTES * 60_000);
  const existing = await ShiftSession.find({ userId: agent._id.toString(), $or: [
    { scheduledStartTime: { $gte: startOfDay, $lt: endOfDay } },
    { clockInTime: { $gte: startOfDay, $lt: endOfDay } },
  ] });

  if (existing.length) {
    if (existing.length === 1 && expectedRecordMatches(existing[0], clockIn, scheduledEnd, clockOut)) {
      console.log("Backfill already present for 2026-07-27; no changes made.");
      return;
    }
    throw new Error("Refusing to overwrite existing shift data for 2026-07-27. Review that date manually before running this backfill.");
  }

  if (dryRun) {
    console.log("Would create 2026-07-27 with 438 worked minutes, 42 break minutes, on-time attendance, 100% adherence, and 98% KPI.");
    return;
  }

  const schedule = await Schedule.findOne({
    userId: agent._id.toString(),
    workDate: { $gte: startOfDay, $lt: endOfDay },
  }).select("_id shiftTemplateId");
  const shift = await ShiftSession.create({
    userId: agent._id.toString(),
    ...(schedule ? { scheduleId: schedule._id, shiftTemplateId: schedule.shiftTemplateId } : {}),
    clockInTime: clockIn, clockOutTime: clockOut, scheduledStartTime: clockIn, scheduledEndTime: scheduledEnd,
    status: "completed", attendanceStatus: "on_time", closureReason: "manual", autoClosed: false,
    totalWorkedMinutes: WORKED_MINUTES, totalBreakMinutes: BREAK_MINUTES, lateMinutes: 0, overtimeMinutes: 0,
    scheduledMinutes: SCHEDULED_MINUTES, workScore: 96, punctualityScore: 100,
    adherenceScore: 100, activityAdherenceScore: 100, kpiScore: 98, kpiEvaluatedAt: clockOut,
  });
  try {
    await ShiftEvent.insertMany([
      { shiftId: shift._id, userId: agent._id.toString(), type: "SHIFT_START", timestamp: clockIn, metadata: { scheduled: true } },
      { shiftId: shift._id, userId: agent._id.toString(), type: "BREAK_START", timestamp: breakStart, metadata: { breakLabel: "Break" } },
      { shiftId: shift._id, userId: agent._id.toString(), type: "BREAK_END", timestamp: breakEnd, metadata: { breakLabel: "Break" } },
      { shiftId: shift._id, userId: agent._id.toString(), type: "SHIFT_END", timestamp: clockOut },
    ]);
  } catch (error) {
    await ShiftEvent.deleteMany({ shiftId: shift._id });
    await ShiftSession.deleteOne({ _id: shift._id });
    throw error;
  }

  console.log("Backfill complete: 2026-07-27 shift created.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });
