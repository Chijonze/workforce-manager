"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { VideoCallButton } from "@/components/video-call-button";
import { AssistantChatIcon } from "@/components/assistant-chat-icon";
import { useAssistant } from "@/components/assistant-provider";
import { openChatwootChat } from "@/lib/chatwoot";

/** Remember the nudge for the session so it never becomes a permanent nag. */
const TEASER_STORAGE_KEY = "avs-ai-teaser-seen";

export function FloatingChat() {
  const { isOpen, openAssistant, closeAssistant } = useAssistant();
  const [showTeaser, setShowTeaser] = useState(false);

  // Show the prompt shortly after load, once per session, and never while open.
  useEffect(() => {
    if (isOpen) {
      setShowTeaser(false);
      try {
        window.sessionStorage.setItem(TEASER_STORAGE_KEY, "1");
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    try {
      if (window.sessionStorage.getItem(TEASER_STORAGE_KEY) === "1") return;
    } catch {
      // Storage can be unavailable (private mode) — the prompt still works.
    }

    const timer = window.setTimeout(() => setShowTeaser(true), 900);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const startConversation = () => {
    setShowTeaser(false);
    try {
      window.sessionStorage.setItem(TEASER_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
    openAssistant();
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
      <div className="relative h-14 w-14">
        {!isOpen && showTeaser && (
          <span
            aria-hidden="true"
            className="avs-fab-pulse pointer-events-none absolute inset-0 rounded-full bg-brand-blue/40"
          />
        )}
        <button
          type="button"
          aria-label={
            isOpen
              ? "Close the AVS AI assistant"
              : "Start a conversation with the AVS AI assistant"
          }
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls="avs-ai-assistant"
          title={isOpen ? "Close the AVS AI assistant" : "Chat with the AVS AI assistant"}
          onClick={() => (isOpen ? closeAssistant() : startConversation())}
          className="group relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-cyan-500 text-white shadow-cta ring-1 ring-white/60 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/40"
        >
          {isOpen ? (
            <X aria-hidden="true" className="h-7 w-7" />
          ) : (
            <>
              <AssistantChatIcon size={32} />
              {showTeaser && (
                <span
                  aria-hidden="true"
                  className="absolute right-full top-1/2 mr-2.5 -translate-y-1/2 sm:mr-3"
                >
                  <span className="avs-teaser relative flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white py-2 pl-2 pr-3 shadow-[0_18px_45px_rgba(7,23,57,0.18)] sm:gap-2.5 sm:py-2.5 sm:pl-2.5 sm:pr-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-blue to-cyan-500 text-white">
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </span>
                    <span className="whitespace-nowrap font-heading text-xs font-semibold leading-none text-navy sm:text-[13px]">
                      Start a conversation
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute -right-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r border-t border-slate-200/80 bg-white"
                    />
                  </span>
                </span>
              )}
            </>
          )}
        </button>
      </div>
      <VideoCallButton
        aria-label="Call us now"
        className="h-14 w-14 min-h-14 gap-0 rounded-full bg-cyan-500 p-0 text-slate-950 shadow-soft ring-1 ring-white/60 transition hover:bg-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-500/30"
        iconSize={28}
        title="Call us now"
      >
        <span className="sr-only">Call us now</span>
      </VideoCallButton>
      <button
        aria-label="Chat with us"
        className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-soft ring-1 ring-white/60 transition hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        onClick={openChatwootChat}
        title="Chat with us"
      >
        <MessageCircle aria-hidden="true" className="h-7 w-7" />
      </button>
    </div>
  );
}
