"use client";

import { MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { openChatwootChat } from "@/lib/chatwoot";

export function ChatButton({ onClick, ...props }: ButtonProps) {
  return (
    <Button
      onClick={(event) => {
        onClick?.(event);
        openChatwootChat();
      }}
      {...props}
    >
      <MessageCircle size={18} />
      {props.children}
    </Button>
  );
}
