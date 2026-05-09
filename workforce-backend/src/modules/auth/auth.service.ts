import bcrypt from "bcryptjs";
import User from "../../models/User";
import { generateToken } from "../../utils/jwt";

const sanitizeUser = (user: any) => {
  const safeUser = user.toObject ? user.toObject() : user;
  delete safeUser.password;
  return safeUser;
};

export const registerUser = async (
  name: string,
  email: string,
  password: string
) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "agent",
  });

  const token = generateToken(user._id.toString());

  return { user: sanitizeUser(user), token };
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken(user._id.toString());

  return { user: sanitizeUser(user), token };
};

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const getUsers = async () => {
  return await User.find().select("_id name email role createdAt").sort({
    name: 1,
  });
};
