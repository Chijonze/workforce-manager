import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import ShiftSession from "../models/ShiftSession";
import User from "../models/User";
import { getUtcDayRange } from "../modules/scheduling/enforcement/enforcement.utils";

const EMAIL = "agent2@advancedvirtualsolutions.com";
const EXTRA_WORKED_MINUTES = 4 * 60;
const apply = process.argv.includes("--apply");
const dateArg = process.argv.find((arg) => arg.startsWith("--date="))?.slice(7);
const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

async function main() {
  const date = dateArg || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const { start, end } = getUtcDayRange(date);
  await connectDB();
  const user = await User.findOne({ email: EMAIL }).select("_id email");
  if (!user) throw new Error(`User not found: ${EMAIL}`);
  const sessions = await ShiftSession.find({ userId: user._id.toString(), $or: [{ scheduledStartTime: { $gte: start, $lt: end } }, { clockInTime: { $gte: start, $lt: end } }] }).sort({ clockInTime: 1 });
  if (sessions.length !== 1) throw new Error(`Expected exactly one session for ${EMAIL} on ${date}; found ${sessions.length}. No changes made.`);
  const session = sessions[0];
  const workedMinutes = Math.max(0, session.totalWorkedMinutes || 0) + EXTRA_WORKED_MINUTES;
  const scheduledMinutes = Math.max(0, session.scheduledMinutes || 0);
  const workScore = scheduledMinutes ? clampPercent((workedMinutes / scheduledMinutes) * 100) : 0;
  const punctualityScore = clampPercent(100 - (session.lateMinutes || 0) * 3);
  const adherenceScore = 100;
  const overallScore = clampPercent(workScore * 0.45 + punctualityScore * 0.25 + adherenceScore * 0.3 - Math.min(20, session.overtimeMinutes || 0));
  const result = { email: EMAIL, date, shiftId: session._id.toString(), previousWorkedMinutes: session.totalWorkedMinutes || 0, workedMinutes, adherenceScore, overallScore, mode: apply ? "apply" : "dry-run" };
  if (!apply) { console.log(JSON.stringify(result, null, 2)); console.log("Dry run only. Re-run with --apply after verifying these values."); return; }
  await ShiftSession.updateOne({ _id: session._id }, { $set: { totalWorkedMinutes: workedMinutes, workScore, adherenceScore, activityAdherenceScore: adherenceScore, kpiScore: overallScore, kpiEvaluatedAt: new Date() } });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
