"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { RagChatWidget } from "@/components/rag-chat-widget";

interface AssistantContextValue {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openAssistant = useCallback(() => setOpen(true), []);
  const closeAssistant = useCallback(() => setOpen(false), []);

  return (
    <AssistantContext.Provider value={{ isOpen: open, openAssistant, closeAssistant }}>
      {children}
      <RagChatWidget open={open} onClose={closeAssistant} />
    </AssistantContext.Provider>
  );
}
