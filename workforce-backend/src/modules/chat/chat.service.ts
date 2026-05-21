import mongoose from "mongoose";
import ChatConversation from "../../models/ChatConversation";
import ChatMessage from "../../models/ChatMessage";
import User from "../../models/User";

const userProjection = "_id name email role";

const normalizeParticipants = (userId: string, recipientId: string) =>
  [userId, recipientId].sort((a, b) => a.localeCompare(b));

const serializeConversation = (conversation: any, currentUserId: string) => {
  const unreadCount = Number(conversation.unreadCount || 0);
  const participants = conversation.participants || [];
  const otherParticipant =
    participants.find((participant: any) => participant._id.toString() !== currentUserId) ||
    participants[0];

  return {
    _id: conversation._id,
    participants,
    otherParticipant,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const ensureChatAllowed = async (currentUser: any, recipientId: string) => {
  if (currentUser.userId === recipientId) {
    throw new Error("Choose another person to start a conversation");
  }

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    throw new Error("Invalid recipient");
  }

  const recipient = await User.findById(recipientId).select(userProjection);

  if (!recipient) {
    throw new Error("Recipient not found");
  }

  if (currentUser.role !== "admin" && recipient.role !== "admin") {
    throw new Error("Users can only message admins");
  }

  return recipient;
};

export const getChatRecipients = async (currentUser: any) => {
  const query =
    currentUser.role === "admin"
      ? { _id: { $ne: currentUser.userId } }
      : { role: "admin", _id: { $ne: currentUser.userId } };

  return User.find(query).select(userProjection).sort({ role: 1, name: 1 });
};

export const listConversations = async (currentUser: any) => {
  const conversations = await ChatConversation.find({
    participants: currentUser.userId,
  })
    .populate("participants", userProjection)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  const unreadCounts = await ChatMessage.aggregate([
    {
      $match: {
        conversationId: { $in: conversations.map((conversation) => conversation._id) },
        senderId: { $ne: new mongoose.Types.ObjectId(currentUser.userId) },
        readBy: { $ne: new mongoose.Types.ObjectId(currentUser.userId) },
      },
    },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);

  const unreadByConversation = new Map(
    unreadCounts.map((item) => [item._id.toString(), item.count])
  );

  return conversations.map((conversation) =>
    serializeConversation(
      {
        ...conversation,
        unreadCount: unreadByConversation.get(conversation._id.toString()) || 0,
      },
      currentUser.userId
    )
  );
};

export const getOrCreateConversation = async (currentUser: any, recipientId: string) => {
  await ensureChatAllowed(currentUser, recipientId);
  const participantIds = normalizeParticipants(currentUser.userId, recipientId);

  let conversation = await ChatConversation.findOne({
    participants: { $all: participantIds, $size: 2 },
  });

  if (!conversation) {
    conversation = await ChatConversation.create({
      participants: participantIds,
      lastMessageAt: new Date(),
    });
  }

  const populated = await conversation.populate("participants", userProjection);
  return serializeConversation(populated.toObject(), currentUser.userId);
};

export const listMessages = async (currentUser: any, conversationId: string) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw new Error("Invalid conversation");
  }

  const conversation = await ChatConversation.findOne({
    _id: conversationId,
    participants: currentUser.userId,
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  await ChatMessage.updateMany(
    {
      conversationId,
      senderId: { $ne: currentUser.userId },
      readBy: { $ne: currentUser.userId },
    },
    { $addToSet: { readBy: currentUser.userId } }
  );

  return ChatMessage.find({ conversationId })
    .populate("senderId", userProjection)
    .sort({ createdAt: 1 });
};

export const sendMessage = async (currentUser: any, recipientId: string, body: string) => {
  const cleanBody = String(body || "").trim();

  if (!cleanBody) {
    throw new Error("Message cannot be empty");
  }

  if (cleanBody.length > 2000) {
    throw new Error("Message is too long");
  }

  const conversation = await getOrCreateConversation(currentUser, recipientId);

  const message = await ChatMessage.create({
    conversationId: conversation._id,
    senderId: currentUser.userId,
    body: cleanBody,
    readBy: [currentUser.userId],
  });

  await ChatConversation.findByIdAndUpdate(conversation._id, {
    lastMessage: cleanBody,
    lastMessageAt: message.createdAt,
  });

  return message.populate("senderId", userProjection);
};
