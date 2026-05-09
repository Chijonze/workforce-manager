import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "agent";
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "agent"], default: "agent" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;