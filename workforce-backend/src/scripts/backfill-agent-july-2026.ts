import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE || ".env" });

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import Schedule from "../models/schedule.model";
import ShiftEvent from "../models/ShiftEvent";
import ShiftSession from "../models/ShiftSession";
import User from "../models/User";

/**
 * One-time historical WFM backfill for agent2@advancedvirtualsolutions.com.
 *
 * It never overwrites a different record. Re-running after a successful
 * backfill is safe and reports the matching records as already present.
 * All timestamps are UTC because the WFM reports days using UTC boundaries.
 */
const AGENT_EMAIL = "agent2@advancedvirtualsolutions.com";
const TARGET_DAYS = [14, 15, 16, 17, 20, 21, 22, 23, 24];
const YEAR = 2026;
const MONTH_INDEX = 6; // July; JavaScript months are zero-based.
const WORKED_MINUTES = 438;
const BREAK_MINUTES = 42;
const SCHEDULED_MINUTES = 456;
const dryRun = !process.argv.includes("--apply");

const atUtc = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(YEAR, MONTH_INDEX, day, hour, minute));

const targetDayRange = (day: number) => ({ start: atUtc(day, 0), end: atUtc(day + 1, 0) });
const sameInstant = (value: Date | undefined, expected: Date) => Boolean(value && value.getTime() === expected.getTime());

function expectedRecordMatches(session: any, day: number) {
  const clockIn = atUtc(day, 8);
  const scheduledEnd = new Date(clockIn.getTime() + SCHEDULED_MINUTES * 60_000);
  const clockOut = new Date(clockIn.getTime() + (WORKED_MINUTES + BREAK_MINUTES) * 60_000);
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

  let created = 0;
  let alreadyPresent = 0;
  for (const day of TARGET_DAYS) {
    const { start, end } = targetDayRange(day);
    const existing = await ShiftSession.find({ userId: agent._id.toString(), $or: [
      { scheduledStartTime: { $gte: start, $lt: end } }, { clockInTime: { $gte: start, $lt: end } },
    ] });
    if (existing.length) {
      if (existing.length === 1 && expectedRecordMatches(existing[0], day)) { alreadyPresent += 1; continue; }
      throw new Error(`Refusing to overwrite existing shift data for ${YEAR}-07-${String(day).padStart(2, "0")}. Review that date manually before running this backfill.`);
    }
    if (dryRun) { console.log(`Would create ${YEAR}-07-${String(day).padStart(2, "0")}.`); continue; }

    const clockIn = atUtc(day, 8);
    const breakStart = new Date(clockIn.getTime() + 219 * 60_000);
    const breakEnd = new Date(breakStart.getTime() + BREAK_MINUTES * 60_000);
    const clockOut = new Date(clockIn.getTime() + (WORKED_MINUTES + BREAK_MINUTES) * 60_000);
    const scheduledEnd = new Date(clockIn.getTime() + SCHEDULED_MINUTES * 60_000);
    const schedule = await Schedule.findOne({ userId: agent._id.toString(), workDate: { $gte: start, $lt: end } }).select("_id shiftTemplateId");
    const shift = await ShiftSession.create({
      userId: agent._id.toString(),
      ...(schedule ? { scheduleId: schedule._id, shiftTemplateId: schedule.shiftTemplateId } : {}),
      clockInTime: clockIn, clockOutTime: clockOut, scheduledStartTime: clockIn, scheduledEndTime: scheduledEnd,
      status: "completed", attendanceStatus: "on_time", closureReason: "manual", autoClosed: false,
      totalWorkedMinutes: WORKED_MINUTES, totalBreakMinutes: BREAK_MINUTES, lateMinutes: 0, overtimeMinutes: 0,
      scheduledMinutes: SCHEDULED_MINUTES,
      // 438 / 456 rounds to a 96% work score; the weighted KPI is 98%.
      workScore: 96, punctualityScore: 100, adherenceScore: 100, activityAdherenceScore: 100,
      kpiScore: 98, kpiEvaluatedAt: clockOut,
    });
    try {
      await ShiftEvent.insertMany([
        { shiftId: shift._id, userId: agent._id.toString(), type: "SHIFT_START", timestamp: clockIn, metadata: { scheduled: true } },
        { shiftId: shift._id, userId: agent._id.toString(), type: "BREAK_START", timestamp: breakStart, metadata: { breakLabel: "Break" } },
        { shiftId: shift._id, userId: agent._id.toString(), type: "BREAK_END", timestamp: breakEnd, metadata: { breakLabel: "Break" } },
        { shiftId: shift._id, userId: agent._id.toString(), type: "SHIFT_END", timestamp: clockOut },
      ]);
    } catch (error) {
      // Remove only the incomplete record created in this invocation.
      await ShiftEvent.deleteMany({ shiftId: shift._id });
      await ShiftSession.deleteOne({ _id: shift._id });
      throw error;
    }
    created += 1;
  }
  console.log(dryRun
    ? `Dry run passed: ${TARGET_DAYS.length - alreadyPresent} shift(s) ready; ${alreadyPresent} already present.`
    : `Backfill complete: ${created} shift(s) created; ${alreadyPresent} already present.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => { await mongoose.disconnect(); });
