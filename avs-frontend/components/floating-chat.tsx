import { MessageCircle } from "lucide-react";
import { site } from "@/lib/site-content";

export function FloatingChat() {
  return (
    <a
      className="fixed bottom-6 right-28 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-blue-600"
      href={site.whatsapp}
    >
      <MessageCircle size={18} />
      Chat with us
    </a>
  );
}
