import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db";
import User from "../models/User";

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

function required(value: string | undefined, variableName: string): string {
  if (!value) {
    throw new Error(`${variableName} is required`);
  }

  return value;
}

async function main() {
  const adminName = required(name, "ADMIN_NAME");
  const adminEmail = required(email, "ADMIN_EMAIL");
  const adminPassword = required(password, "ADMIN_PASSWORD");

  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }

  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long");
  }

  await connectDB();

  const existingUser = await User.findOne({ email: adminEmail }).select("_id email role");
  if (existingUser) {
    throw new Error(
      `An account already exists for ${adminEmail} with the ${existingUser.role} role. No changes were made.`
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await User.create({
    name: adminName,
    email: adminEmail,
    password: passwordHash,
    role: "admin",
    accountStatus: "approved",
  });

  console.log(`Admin account created for ${admin.email} (id: ${admin._id}).`);
  console.log("On first sign-in, complete the MFA setup if MFA_REQUIRED is enabled.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
