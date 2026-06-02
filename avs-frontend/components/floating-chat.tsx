import { site } from "@/lib/site-content";

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      fill="none"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 4.25a11.25 11.25 0 0 0-9.47 17.33L5.25 27l5.55-1.25A11.25 11.25 0 1 0 16 4.25Z"
        fill="white"
      />
      <path
        d="M16 6.25a9.25 9.25 0 0 0-7.7 14.37l.35.52-.75 3.08 3.18-.72.5.3A9.25 9.25 0 1 0 16 6.25Z"
        fill="#25D366"
      />
      <path
        d="M20.98 18.3c-.27-.14-1.58-.78-1.82-.87-.25-.09-.43-.14-.61.14-.18.27-.7.87-.86 1.05-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.34-.8-.71-1.34-1.6-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.98 2.64 1.11 2.82.14.18 1.92 2.93 4.66 4.11.65.28 1.16.45 1.56.57.66.21 1.25.18 1.72.11.52-.08 1.58-.65 1.8-1.27.23-.63.23-1.16.16-1.27-.07-.11-.25-.18-.52-.32Z"
        fill="white"
      />
    </svg>
  );
}

export function FloatingChat() {
  return (
    <a
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-28 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-soft ring-1 ring-white/60 transition hover:bg-[#1ebe5d] focus:outline-none focus:ring-4 focus:ring-[#25D366]/30"
      href={site.whatsapp}
      title="Chat with us on WhatsApp"
    >
      <WhatsAppIcon />
    </a>
  );
}
