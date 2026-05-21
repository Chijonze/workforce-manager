import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChatConversation extends Document {
  participants: Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
}

const chatConversationSchema = new Schema<IChatConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

chatConversationSchema.index({ participants: 1 });
chatConversationSchema.index({ lastMessageAt: -1 });

const ChatConversation =
  mongoose.models.ChatConversation ||
  mongoose.model<IChatConversation>("ChatConversation", chatConversationSchema);

export default ChatConversation;
