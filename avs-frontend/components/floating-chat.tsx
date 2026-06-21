"use client";

import { MessageCircle } from "lucide-react";
import { openChatwootChat } from "@/lib/chatwoot";

export function FloatingChat() {
  return (
    <div className="fixed bottom-6 right-6 z-40">
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
