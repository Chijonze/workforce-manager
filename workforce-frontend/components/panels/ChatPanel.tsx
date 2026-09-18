"use client";

import { FormEvent } from "react";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import type { ChatConversation, ChatMessage, User } from "@/types/workforce";
import { formatDateTime } from "@/lib/api";
import { formatRole } from "../shared";

export default function ChatPanel({
  conversations,
  currentUser,
  draft,
  loading,
  messages,
  onChangeDraft,
  onChangeRecipient,
  onRefresh,
  onSelectConversation,
  onSendMessage,
  onStartConversation,
  recipients,
  selectedConversationId,
  selectedRecipientId,
}: {
  conversations: ChatConversation[];
  currentUser: User;
  draft: string;
  loading: boolean;
  messages: ChatMessage[];
  recipients: User[];
  selectedConversationId: string | null;
  selectedRecipientId: string;
  onChangeDraft: (value: string) => void;
  onChangeRecipient: (value: string) => void;
  onRefresh: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onStartConversation: () => void;
}) {
  const activeConversation =
    conversations.find((conversation) => conversation._id === selectedConversationId) || null;
  const activeRecipient =
    activeConversation?.otherParticipant ||
    recipients.find((recipient) => recipient._id === selectedRecipientId);

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div className="panel-title">
          <MessageSquare size={20} />
          <div>
            <h2>Team Chat</h2>
            <p className="panel-subtitle">
              Message agents, hiring managers, and admins
            </p>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh chat">
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-compose">
            <div className="field">
              <label htmlFor="chat-recipient">Start or open chat</label>
              <select
                id="chat-recipient"
                value={selectedRecipientId}
                onChange={(event) => onChangeRecipient(event.target.value)}
                disabled={!recipients.length}
              >
                {recipients.length ? (
                  recipients.map((recipient) => (
                    <option key={recipient._id} value={recipient._id}>
                      {recipient.name} ({formatRole(recipient.role)})
                    </option>
                  ))
                ) : (
                  <option value="">No recipients available</option>
                )}
              </select>
            </div>
            <button
              className="button secondary"
              disabled={loading || !selectedRecipientId}
              type="button"
              onClick={onStartConversation}
            >
              <MessageSquare size={17} />
              Open
            </button>
          </div>

          <div className="chat-conversations">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  className={`conversation-button ${
                    conversation._id === selectedConversationId ? "active" : ""
                  }`}
                  key={conversation._id}
                  type="button"
                  onClick={() => onSelectConversation(conversation._id)}
                >
                  <span>
                    <strong>{conversation.otherParticipant?.name || "Conversation"}</strong>
                    <small>{conversation.lastMessage || "No messages yet"}</small>
                  </span>
                  {conversation.unreadCount > 0 && (
                    <i aria-label={`${conversation.unreadCount} unread messages`}>
                      {conversation.unreadCount}
                    </i>
                  )}
                </button>
              ))
            ) : (
              <p className="muted">No conversations yet.</p>
            )}
          </div>
        </aside>

        <div className="chat-thread">
          <div className="chat-thread-head">
            <div>
              <strong>{activeRecipient?.name || "Select a conversation"}</strong>
              <span>{activeRecipient?.email || "Choose who you want to message."}</span>
            </div>
            {activeRecipient && <span className="pill">{formatRole(activeRecipient.role)}</span>}
          </div>

          <div className="message-list">
            {messages.length ? (
              messages.map((message) => {
                const mine = message.senderId._id === currentUser._id;
                return (
                  <article className={`message-bubble ${mine ? "mine" : ""}`} key={message._id}>
                    <strong>{mine ? "You" : message.senderId.name}</strong>
                    <p>{message.body}</p>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </article>
                );
              })
            ) : (
              <p className="muted">No messages in this conversation yet.</p>
            )}
          </div>

          <form className="chat-input" onSubmit={onSendMessage}>
            <input
              aria-label="Message"
              maxLength={2000}
              placeholder={activeRecipient ? `Message ${activeRecipient.name}` : "Select a recipient"}
              value={draft}
              onChange={(event) => onChangeDraft(event.target.value)}
              disabled={!activeRecipient}
            />
            <button className="button" disabled={loading || !activeRecipient || !draft.trim()} type="submit">
              <Send size={17} />
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
