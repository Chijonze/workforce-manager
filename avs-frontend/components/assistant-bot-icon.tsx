import type { SVGProps } from "react";

interface AssistantBotIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * AVS assistant mark — robot face inside a speech bubble.
 * Geometry mirrors the reference SVG; strokes use currentColor and run
 * slightly heavier than the source so the mark stays legible at 18-28px.
 */
export function AssistantBotIcon({ size = 24, ...props }: AssistantBotIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      {...props}
    >
      {/* Speech bubble */}
      <path
        d="M 23 81.5 L 18.8 67.5 A 38 38 0 1 1 43.5 85 L 23 81.5 Z"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Antenna */}
      <circle cx="50" cy="28.5" r="3.2" stroke="currentColor" strokeWidth={4.4} />
      <line x1="50" y1="31.8" x2="50" y2="37" stroke="currentColor" strokeWidth={4.4} strokeLinecap="round" />
      {/* Ears */}
      <rect x="28.5" y="47" width="5" height="10" rx="2.5" stroke="currentColor" strokeWidth={4.4} />
      <rect x="66.5" y="47" width="5" height="10" rx="2.5" stroke="currentColor" strokeWidth={4.4} />
      {/* Outer head */}
      <rect x="33.5" y="37" width="33" height="30" rx="9" stroke="currentColor" strokeWidth={4.8} />
      {/* Inner face screen */}
      <rect x="38.5" y="42" width="23" height="20" rx="6" stroke="currentColor" strokeWidth={4} />
      {/* Eyes */}
      <circle cx="45.5" cy="51.5" r="2.4" fill="currentColor" />
      <circle cx="54.5" cy="51.5" r="2.4" fill="currentColor" />
    </svg>
  );
}
