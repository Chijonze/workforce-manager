"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal, X } from "lucide-react";
import { AssistantBotIcon } from "@/components/assistant-bot-icon";
import { suggestedQuestions } from "@/lib/rag/knowledge-base";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; category: string }[];
}

interface RagChatWidgetProps {
  open: boolean;
  onClose: () => void;
}

export function RagChatWidget({ open, onClose }: RagChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi there! 👋 I'm the AVS assistant. Ask me anything about our virtual assistant services — pricing, onboarding, security, or what you can delegate.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const history = messages
      .filter((m) => m.sources !== undefined || m.role === "user")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data?.error ?? "Something went wrong. Please try again." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, sources: data.sources },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn't reach the server just now. Please try again — or email admin@advancedvirtualsolutions.com and we'll get right back to you.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed bottom-28 right-4 z-50 flex h-[min(600px,72vh)] w-[min(94vw,390px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft sm:bottom-28 sm:right-6"
      role="dialog"
      aria-label="AVS assistant chat"
    >
      {/* Header */}
      <div className="flex items-center gap-3 bg-navy px-4 py-3.5 text-white">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-cyan-400">
          <AssistantBotIcon size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold leading-tight">AVS Assistant</p>
          <p className="truncate text-xs text-slate-300">
            Ask about services, pricing &amp; onboarding
          </p>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-cloud px-4 py-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={
              message.role === "user"
                ? "flex justify-end"
                : "flex items-start gap-2"
            }
          >
            {message.role === "assistant" && (
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-brand-blue shadow-card">
                <AssistantBotIcon size={19} />
              </span>
            )}
            <div className="max-w-[85%]">
              <div
                className={
                  message.role === "user"
                    ? "rounded-2xl rounded-br-md bg-brand-blue px-4 py-2.5 text-sm text-white shadow-cta"
                    : "rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-card"
                }
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
              {message.sources && message.sources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {message.sources.slice(0, 3).map((source) => (
                    <span
                      key={source.title}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400"
                    >
                      {source.category}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-brand-blue shadow-card">
              <AssistantBotIcon size={19} />
            </span>
            <div className="flex gap-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-card">
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Suggested questions (only before first user message) */}
      {messages.length === 1 && !loading && (
        <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white px-4 py-2.5">
          {suggestedQuestions.slice(0, 4).map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => send(question)}
              className="shrink-0 rounded-full border border-brand-blue/30 bg-blue-50 px-3 py-1.5 text-xs font-medium text-brand-blue transition hover:bg-brand-blue hover:text-white"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          aria-label="Type your question"
          maxLength={1200}
          className="min-h-11 flex-1 rounded-full"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!input.trim() || loading}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-blue text-white shadow-cta transition hover:bg-brand-blue-dark focus:outline-none focus:ring-4 focus:ring-brand-blue/30 disabled:opacity-40"
        >
          <SendHorizonal aria-hidden="true" className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
