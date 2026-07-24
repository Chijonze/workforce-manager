import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../../models/User";
import ChatConversation from "../../models/ChatConversation";
import ChatMessage from "../../models/ChatMessage";
import LeaveRequest from "../../models/LeaveRequest";
import Schedule from "../../models/schedule.model";
import ShiftEvent from "../../models/ShiftEvent";
import ShiftSession from "../../models/ShiftSession";
import { generateMfaToken, generateToken, verifyMfaToken } from "../../utils/jwt";
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from "../../utils/totp";

const isMfaRequired = () => process.env.MFA_REQUIRED !== "false";
const isMfaExemptRole = (role?: string) => role === "supervisor";

const sanitizeUser = (user: any) => {
  const safeUser = user.toObject ? user.toObject() : user;
  delete safeUser.password;
  delete safeUser.mfaSecret;
  delete safeUser.mfaPendingSecret;
  return safeUser;
};

const setMonitorSession = async (userId: string, active: boolean) => {
  await User.findByIdAndUpdate(userId, {
    monitorSessionActive: active,
    ...(active ? { monitorLastLoginAt: new Date() } : { monitorLastLogoutAt: new Date() }),
  });
};

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  requestedRole: "agent" | "supervisor" = "agent",
  organizationName?: string,
  organizationAddress?: string,
  companyNumber?: string
) => {
  const role = requestedRole === "supervisor" ? "supervisor" : "agent";
  const normalizedOrganizationName = organizationName?.trim();
  const normalizedOrganizationAddress = organizationAddress?.trim();
  const normalizedCompanyNumber = companyNumber?.trim();

  if (role === "supervisor" && (!normalizedOrganizationName || !normalizedOrganizationAddress || !normalizedCompanyNumber)) {
    throw new Error("Organisation name, address, and company number are required for hiring managers");
  }
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    ...(role === "supervisor" ? {
      organizationName: normalizedOrganizationName,
      organizationAddress: normalizedOrganizationAddress,
      companyNumber: normalizedCompanyNumber,
    } : {}),
    accountStatus: role === "supervisor" ? "pending" : "approved",
  });

  const token = generateToken(user._id.toString(), !isMfaRequired());
  await setMonitorSession(user._id.toString(), !isMfaRequired());

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

  const mfaExempt = isMfaExemptRole(user.role);

  if (!mfaExempt && !user.mfaEnabled && isMfaRequired()) {
    return {
      mfaSetupRequired: true,
      token: generateToken(user._id.toString(), false),
      user: sanitizeUser(user),
    };
  }

  if (!mfaExempt && user.mfaEnabled) {
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
  await setMonitorSession(user._id.toString(), true);

  return { user: sanitizeUser(user), token, mfaRequired: false };
};

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const logoutUser = async (userId: string) => {
  await setMonitorSession(userId, false);

  return { ok: true };
};

export const getUsers = async () => {
  return await User.find().select("_id name email organizationName organizationAddress companyNumber role accountStatus mfaEnabled assignedAgentIds createdAt").sort({
    name: 1,
  });
};

export const updateHiringManagerProfile = async (
  userId: string,
  name: string,
  organizationName: string,
  organizationAddress: string,
  companyNumber: string
) => {
  const normalizedName = name?.trim();
  const normalizedOrganizationName = organizationName?.trim();
  const normalizedOrganizationAddress = organizationAddress?.trim();
  const normalizedCompanyNumber = companyNumber?.trim();

  if (!normalizedName || !normalizedOrganizationName || !normalizedOrganizationAddress || !normalizedCompanyNumber) {
    throw new Error("Name, organisation name, address, and company number are required");
  }

  const user = await User.findById(userId).select("_id name email organizationName organizationAddress companyNumber role accountStatus mfaEnabled");
  if (!user || user.role !== "supervisor") {
    throw new Error("Hiring manager not found");
  }

  user.name = normalizedName;
  user.organizationName = normalizedOrganizationName;
  user.organizationAddress = normalizedOrganizationAddress;
  user.companyNumber = normalizedCompanyNumber;
  await user.save();

  return sanitizeUser(user);
};

export const updateAssignedAgents = async (supervisorId: string, agentIds: string[]) => {
  if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
    throw new Error("Invalid hiring manager");
  }

  const supervisor = await User.findById(supervisorId).select("_id role assignedAgentIds");
  if (!supervisor || supervisor.role !== "supervisor") {
    throw new Error("Hiring manager not found");
  }

  const uniqueAgentIds = [...new Set((agentIds || []).map(String))].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  const agents = await User.find({ _id: { $in: uniqueAgentIds }, role: "agent" }).select("_id");
  supervisor.assignedAgentIds = agents.map((agent) => agent._id);
  await supervisor.save();

  return sanitizeUser(supervisor);
};

export const approveUserAccount = async (targetUserId: string) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid user");
  }

  const user = await User.findById(targetUserId).select("_id name role accountStatus");

  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "admin") {
    throw new Error("Admin accounts do not require approval");
  }

  user.accountStatus = "approved";
  await user.save();

  return sanitizeUser(user);
};

export const deleteUserAccount = async (currentUserId: string, targetUserId: string) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new Error("Invalid user");
  }

  if (currentUserId === targetUserId) {
    throw new Error("Admins cannot delete their own account");
  }

  const targetUser = await User.findById(targetUserId).select("_id name role");

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (targetUser.role === "admin") {
    throw new Error("Admin accounts cannot be deleted from the dashboard");
  }

  const targetObjectId = new mongoose.Types.ObjectId(targetUserId);
  const conversations = await ChatConversation.find({
    participants: targetObjectId,
  }).select("_id");
  const conversationIds = conversations.map((conversation) => conversation._id);

  const [
    schedules,
    shiftSessions,
    shiftEvents,
    leaveRequests,
    chatMessages,
    chatConversations,
  ] = await Promise.all([
    Schedule.deleteMany({ userId: targetUserId }),
    ShiftSession.deleteMany({ userId: targetUserId }),
    ShiftEvent.deleteMany({ userId: targetUserId }),
    LeaveRequest.deleteMany({
      $or: [{ userId: targetUserId }, { reviewedBy: targetUserId }],
    }),
    ChatMessage.deleteMany({
      $or: [{ senderId: targetObjectId }, { conversationId: { $in: conversationIds } }],
    }),
    ChatConversation.deleteMany({ _id: { $in: conversationIds } }),
  ]);

  await User.findByIdAndDelete(targetUserId);

  return {
    deletedUserId: targetUserId,
    deletedUserName: targetUser.name,
    deletedCounts: {
      schedules: schedules.deletedCount || 0,
      shiftSessions: shiftSessions.deletedCount || 0,
      shiftEvents: shiftEvents.deletedCount || 0,
      leaveRequests: leaveRequests.deletedCount || 0,
      chatMessages: chatMessages.deletedCount || 0,
      chatConversations: chatConversations.deletedCount || 0,
    },
  };
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
  await setMonitorSession(user._id.toString(), true);

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

  await setMonitorSession(user._id.toString(), true);

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
