import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing in .env file");
  }

  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ DB connection error:", error);
    process.exit(1);
  }
};