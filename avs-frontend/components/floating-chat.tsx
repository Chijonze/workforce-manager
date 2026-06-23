"use client";

import { MessageCircle } from "lucide-react";
import { VideoCallButton } from "@/components/video-call-button";
import { openChatwootChat } from "@/lib/chatwoot";

export function FloatingChat() {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
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
