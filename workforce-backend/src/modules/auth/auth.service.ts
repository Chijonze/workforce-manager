import bcrypt from "bcryptjs";
import User from "../../models/User";
import { generateMfaToken, generateToken, verifyMfaToken } from "../../utils/jwt";
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from "../../utils/totp";

const isMfaRequired = () => process.env.MFA_REQUIRED !== "false";

const sanitizeUser = (user: any) => {
  const safeUser = user.toObject ? user.toObject() : user;
  delete safeUser.password;
  delete safeUser.mfaSecret;
  delete safeUser.mfaPendingSecret;
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

  const token = generateToken(user._id.toString(), !isMfaRequired());

  return {
    user: sanitizeUser(user),
    token,
    mfaSetupRequired: isMfaRequired(),
  };
};

export const loginUser = async (email: string, password: string, mfaCode?: string) => {
  const user = await User.findOne({ email }).select("+password +mfaSecret");

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  if (!user.mfaEnabled && isMfaRequired()) {
    return {
      mfaSetupRequired: true,
      token: generateToken(user._id.toString(), false),
      user: sanitizeUser(user),
    };
  }

  if (user.mfaEnabled) {
    if (!mfaCode) {
      return {
        mfaRequired: true,
        mfaToken: generateMfaToken(user._id.toString()),
        user: sanitizeUser(user),
      };
    }

    const secret = user.mfaSecret ? decryptTotpSecret(user.mfaSecret) : null;

    if (!secret || !verifyTotpCode(secret, mfaCode)) {
      throw new Error("Invalid authenticator code");
    }
  }

  const token = generateToken(user._id.toString());

  return { user: sanitizeUser(user), token, mfaRequired: false };
};

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const getUsers = async () => {
  return await User.find().select("_id name email role mfaEnabled createdAt").sort({
    name: 1,
  });
};

export const startMfaSetup = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const secret = generateTotpSecret();
  user.mfaPendingSecret = encryptTotpSecret(secret);
  await user.save();

  return {
    manualKey: secret,
    otpauthUrl: buildTotpUri(user.email, secret),
  };
};

export const confirmMfaSetup = async (userId: string, code: string) => {
  const user = await User.findById(userId).select("+mfaPendingSecret +mfaSecret");

  if (!user || !user.mfaPendingSecret) {
    throw new Error("No pending MFA setup found");
  }

  const pendingSecret = decryptTotpSecret(user.mfaPendingSecret);

  if (!verifyTotpCode(pendingSecret, code)) {
    throw new Error("Invalid authenticator code");
  }

  user.mfaSecret = user.mfaPendingSecret;
  user.mfaPendingSecret = undefined;
  user.mfaEnabled = true;
  await user.save();

  return {
    user: sanitizeUser(user),
    token: generateToken(user._id.toString(), true),
  };
};

export const verifyLoginMfa = async (mfaToken: string, code: string) => {
  const userId = verifyMfaToken(mfaToken);
  const user = await User.findById(userId).select("+mfaSecret");

  const secret = user?.mfaSecret ? decryptTotpSecret(user.mfaSecret) : null;

  if (!user || !secret || !verifyTotpCode(secret, code)) {
    throw new Error("Invalid authenticator code");
  }

  return {
    token: generateToken(user._id.toString()),
    user: sanitizeUser(user),
    mfaRequired: false,
  };
};

export const verifyReturnMfa = async (userId: string, code: string) => {
  const user = await User.findById(userId).select("+mfaSecret");

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.mfaEnabled) {
    return { verified: true };
  }

  const secret = user.mfaSecret ? decryptTotpSecret(user.mfaSecret) : null;

  if (!secret || !verifyTotpCode(secret, code)) {
    throw new Error("Invalid authenticator code");
  }

  return { verified: true };
};
