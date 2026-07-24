import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  organizationName?: string;
  organizationAddress?: string;
  companyNumber?: string;
  password: string;
  role: "admin" | "supervisor" | "agent";
  accountStatus: "pending" | "approved";
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaPendingSecret?: string;
  assignedAgentIds?: mongoose.Types.ObjectId[];
  monitorSessionActive?: boolean;
  monitorLastLoginAt?: Date;
  monitorLastLogoutAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    organizationName: { type: String, trim: true },
    organizationAddress: { type: String, trim: true },
    companyNumber: { type: String, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "supervisor", "agent"], default: "agent" },
    accountStatus: { type: String, enum: ["pending", "approved"], default: "approved" },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    mfaPendingSecret: { type: String, select: false },
    assignedAgentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    monitorSessionActive: { type: Boolean, default: false },
    monitorLastLoginAt: Date,
    monitorLastLogoutAt: Date,
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;
