import type { SVGProps } from "react";

interface AssistantChatIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * AVS AI assistant mark — a rounded chat bubble with a sparkle.
 *
 * Deliberately not a robot: a speech bubble reads instantly as "start a
 * conversation", while the sparkle signals the AI behind it. The mark is
 * drawn on a 24px grid with Lucide-style 2px strokes so it sits comfortably
 * beside the rest of the icon set at 18-32px, and it inherits colour through
 * `currentColor` for use on light buttons and the gradient launcher.
 */
export function AssistantChatIcon({ size = 24, ...props }: AssistantChatIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* Chat bubble with a soft tail */}
      <path
        d="M7.4 7.2H13a4.2 4.2 0 0 1 4.2 4.2v1.2a4.2 4.2 0 0 1-4.2 4.2h-2.7l-2.05 2.75c-.3.42-.9.22-.9-.28V16.8A4.2 4.2 0 0 1 3.2 12.6v-1.2a4.2 4.2 0 0 1 4.2-4.2Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Conversation dots */}
      <circle cx="7.6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="11.75" cy="12" r="1.3" fill="currentColor" />
      {/* AI sparkle */}
      <path
        d="M19.35 2.2C19.81 4.11 20.34 4.64 22.25 5.1C20.34 5.56 19.81 6.09 19.35 8C18.89 6.09 18.36 5.56 16.45 5.1C18.36 4.64 18.89 4.11 19.35 2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
