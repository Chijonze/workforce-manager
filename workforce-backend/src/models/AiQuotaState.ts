import mongoose, { Document, Schema } from "mongoose";

/**
 * Persisted Gemini quota state. The free tier enforces a daily request cap that
 * resets at midnight Pacific, and the reset instant is only discoverable from
 * the 429 body. Keeping it in Mongo means a container restart does not send the
 * retry loop straight back into an exhausted quota.
 */
export interface IAiQuotaState extends Document {
  scope: string;
  aiModel: string;
  blockedUntil?: Date | null;
  reason: string;
  /** Business-time-zone day (YYYY-MM-DD) the counter belongs to. */
  attemptsDayKey: string;
  attemptsToday: number;
  updatedAt?: Date;
  createdAt?: Date;
}

const aiQuotaStateSchema = new Schema<IAiQuotaState>(
  {
    scope: { type: String, required: true, unique: true },
    aiModel: { type: String, default: "" },
    blockedUntil: { type: Date, default: null },
    reason: { type: String, default: "" },
    attemptsDayKey: { type: String, default: "" },
    attemptsToday: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.AiQuotaState ||
  mongoose.model<IAiQuotaState>("AiQuotaState", aiQuotaStateSchema);
