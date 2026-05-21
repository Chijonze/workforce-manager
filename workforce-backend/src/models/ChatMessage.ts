import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChatMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  readBy: Types.ObjectId[];
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });

const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>("ChatMessage", chatMessageSchema);

export default ChatMessage;
