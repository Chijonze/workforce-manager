import type { DelegationIllustrationVariant } from "@/lib/site-content";

const palette = {
  panel: "#0D2352",
  line: "#3A6CF4",
  soft: "#7B9BFF",
  faint: "#2A4A8F",
  bright: "#10B981",
  brightSoft: "#6EE7B7",
};

function InboxArt() {
  return (
    <>
      <rect x="20" y="22" width="72" height="44" rx="8" fill={palette.panel} stroke={palette.line} strokeWidth="2" />
      <path d="M20 32 L60 54 L100 32" fill="none" stroke={palette.soft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 27 L52 45 M94 27 L68 45" stroke={palette.faint} strokeWidth="2" strokeLinecap="round" />
      <circle cx="94" cy="22" r="11" fill={palette.bright} />
      <path d="M89 22l3.5 3.5L99 19" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function CalendarArt() {
  return (
    <>
      <rect x="24" y="20" width="72" height="46" rx="8" fill={palette.panel} stroke={palette.line} strokeWidth="2" />
      <path d="M24 32 H96" stroke={palette.line} strokeWidth="2" />
      <path d="M40 15 V25 M80 15 V25" stroke={palette.soft} strokeWidth="3" strokeLinecap="round" />
      <rect x="32" y="40" width="14" height="12" rx="3" fill={palette.faint} />
      <rect x="74" y="40" width="14" height="12" rx="3" fill={palette.faint} />
      <rect x="53" y="40" width="14" height="12" rx="3" fill={palette.bright} />
      <circle cx="60" cy="46" r="2" fill="#FFFFFF" />
    </>
  );
}

function SupportArt() {
  return (
    <>
      <path d="M40 48 V42 a20 20 0 0 1 40 0 v6" fill="none" stroke={palette.soft} strokeWidth="3" strokeLinecap="round" />
      <rect x="31" y="44" width="13" height="19" rx="6.5" fill={palette.line} />
      <rect x="76" y="44" width="13" height="19" rx="6.5" fill={palette.line} />
      <path d="M83 63 v2 a9 9 0 0 1 -9 9 h-5" fill="none" stroke={palette.bright} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="66" cy="74" r="3" fill={palette.bright} />
      <rect x="78" y="7" width="30" height="18" rx="8" fill={palette.bright} />
      <path d="M85 25 v6 l8 -6 z" fill={palette.bright} />
      <circle cx="87" cy="16" r="1.9" fill="#E9FFF6" />
      <circle cx="93" cy="16" r="1.9" fill="#E9FFF6" />
      <circle cx="99" cy="16" r="1.9" fill="#E9FFF6" />
    </>
  );
}

function LeadsArt() {
  return (
    <>
      <circle cx="52" cy="38" r="20" fill="rgba(58,108,244,0.18)" stroke={palette.line} strokeWidth="2.5" />
      <circle cx="52" cy="32" r="6" fill={palette.soft} />
      <path d="M42 50 a10 9 0 0 1 20 0" fill={palette.soft} />
      <path d="M66 52 L82 68" stroke={palette.soft} strokeWidth="5" strokeLinecap="round" />
      <path d="M99 16l2.4 5.8 5.8 2.4-5.8 2.4L99 32.4l-2.4-5.8-5.8-2.4 5.8-2.4z" fill={palette.bright} />
      <circle cx="88" cy="38" r="2.2" fill={palette.bright} />
    </>
  );
}

function CrmArt() {
  return (
    <>
      <rect x="18" y="28" width="48" height="34" rx="6" fill={palette.panel} stroke={palette.line} strokeWidth="2" />
      <circle cx="31" cy="40" r="5.5" fill={palette.soft} />
      <path d="M23 54 a8 6.5 0 0 1 16 0" fill={palette.soft} />
      <path d="M43 37 H59 M43 45 H55" stroke={palette.faint} strokeWidth="3" strokeLinecap="round" />
      <path d="M70 46 L80 40 M88 30 L95 25" stroke={palette.soft} strokeWidth="2" strokeLinecap="round" />
      <circle cx="84" cy="42" r="5" fill={palette.line} />
      <circle cx="92" cy="31" r="5" fill={palette.line} />
      <circle cx="101" cy="20" r="6.5" fill={palette.bright} />
      <path d="M98 20l2.2 2.2 4-4" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function ResearchArt() {
  return (
    <>
      <rect x="32" y="14" width="44" height="58" rx="6" fill={palette.panel} stroke={palette.line} strokeWidth="2" />
      <path d="M40 26 H68 M40 34 H60 M40 42 H54" stroke={palette.faint} strokeWidth="3" strokeLinecap="round" />
      <circle cx="76" cy="52" r="13" fill="rgba(16,185,129,0.14)" stroke={palette.bright} strokeWidth="2.5" />
      <path d="M70 55 l4.5 -4.5 l3.5 3 l7 -7.5" fill="none" stroke={palette.brightSoft} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M85.5 61.5 L96 72" stroke={palette.bright} strokeWidth="4.5" strokeLinecap="round" />
    </>
  );
}

function ContentArt() {
  return (
    <>
      <rect x="30" y="14" width="44" height="58" rx="6" fill={palette.panel} stroke={palette.line} strokeWidth="2" />
      <path d="M38 26 H66 M38 34 H58 M38 42 H50" stroke={palette.faint} strokeWidth="3" strokeLinecap="round" />
      <circle cx="52" cy="56" r="1.8" fill={palette.bright} />
      <circle cx="59" cy="56" r="1.8" fill={palette.soft} />
      <circle cx="66" cy="56" r="1.8" fill={palette.faint} />
      <path d="M62 60 L84 32" stroke={palette.bright} strokeWidth="5" strokeLinecap="round" />
      <path d="M55 69 l3.6 -8.4 l5 5 z" fill={palette.soft} />
    </>
  );
}

function OperationsArt() {
  return (
    <>
      <rect x="22" y="14" width="72" height="52" rx="8" fill={palette.panel} stroke={palette.line} strokeWidth="2" />
      <path d="M46 14 V66 M70 14 V66" stroke={palette.faint} strokeWidth="2" />
      <rect x="28" y="22" width="12" height="9" rx="2.5" fill={palette.soft} />
      <rect x="28" y="36" width="12" height="9" rx="2.5" fill={palette.soft} />
      <rect x="52" y="22" width="12" height="9" rx="2.5" fill={palette.line} />
      <rect x="52" y="48" width="12" height="9" rx="2.5" fill={palette.line} />
      <rect x="76" y="22" width="12" height="9" rx="2.5" fill={palette.bright} />
      <rect x="76" y="36" width="12" height="9" rx="2.5" fill={palette.bright} />
      <circle cx="100" cy="62" r="10" fill={palette.bright} />
      <path d="M95.5 62l3.2 3.2 6 -6" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const artByVariant: Record<DelegationIllustrationVariant, () => React.JSX.Element> = {
  inbox: InboxArt,
  calendar: CalendarArt,
  support: SupportArt,
  leads: LeadsArt,
  crm: CrmArt,
  research: ResearchArt,
  content: ContentArt,
  operations: OperationsArt,
};

export function DelegationIllustration({
  variant,
  className,
}: {
  variant: DelegationIllustrationVariant;
  className?: string;
}) {
  const Art = artByVariant[variant];
  return (
    <svg
      viewBox="0 0 120 80"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <Art />
    </svg>
  );
}
