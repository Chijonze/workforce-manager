import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  Handshake,
  Headphones,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageCircle,
  MonitorCheck,
  PenTool,
  Receipt,
  RefreshCcw,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";

export const site = {
  name: "Advanced Virtual Solutions",
  shortName: "AVS",
  domain: "https://advancedvirtualsolutions.com",
  logo: "/avs-logo.png",
  wordmarkLogo: "/avs-logo-wordmark.png",
  email: "admin@advancedvirtualsolutions.com",
  phone: "44 7882 615046",
  phoneDisplay: "+44 7882 615046",
  phoneHref: "tel:+447882615046",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/447882615046",
  hours: "UK/EU business hours, Monday to Friday",
  tagline: "Dedicated virtual assistants for founders, agencies, coaches, eCommerce brands, and growing teams.",
};

export const navigation = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Industries", href: "/#industries" },
  { label: "Resources", href: "/#resources" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const announcementPoints = [
  "Fast onboarding",
  "Dedicated assistants",
  "Flexible hourly support",
];

export const heroContent = {
  eyebrow: "Advanced Virtual Solutions",
  headline: "Scale Your Business Without Getting Stuck in the Day‑to‑Day",
  headlinePromise: "Save 20+ Hours a Week — Guaranteed.",
  subheadline:
    "Dedicated virtual assistants for founders, agencies, coaches, eCommerce brands and growing teams — with every shift scheduled, verified and reported.",
  primaryCta: "Book Free Consultation",
  secondaryCta: "Explore Services",
  microTrust: ["Dedicated Assistants", "Verified Hours", "Shift Reporting", "Planned Cover"],
};

export const metrics = [
  { value: "20+", label: "Hours Saved Weekly", detail: "Average per client after the first month" },
  { value: "10,000+", label: "Tasks Completed", detail: "Tracked, reported, and delivered" },
  { value: "98%", label: "Client Satisfaction", detail: "Across ongoing engagements" },
  { value: "<2h", label: "Average Response Time", detail: "During agreed working hours" },
  { value: "95%", label: "Retention Rate", detail: "Clients stay with us long term" },
  { value: "300+", label: "Projects Delivered", detail: "Across eight service lines" },
];

export const delegationTasks = [
  {
    title: "Inbox Management",
    description: "A tidy inbox with every priority answered, flagged, or drafted for your review.",
    illustration: "inbox",
  },
  {
    title: "Calendar Management",
    description: "Scheduling, rescheduling, and meeting prep handled before it reaches your plate.",
    illustration: "calendar",
  },
  {
    title: "Customer Support",
    description: "Email, chat, and helpdesk coverage that keeps response times sharp.",
    illustration: "support",
  },
  {
    title: "Lead Generation",
    description: "Prospect research, list building, outreach, and follow-up that keeps pipeline full.",
    illustration: "leads",
  },
  {
    title: "CRM Management",
    description: "Clean records, updated deals, and follow-up reminders your sales team can trust.",
    illustration: "crm",
  },
  {
    title: "Research",
    description: "Market scans, competitor summaries, and vendor shortlists delivered as briefs.",
    illustration: "research",
  },
  {
    title: "Content Support",
    description: "Blog drafts, newsletters, captions, and design files ready for your approval.",
    illustration: "content",
  },
  {
    title: "Operations Coordination",
    description: "Task boards, SOPs, vendor follow-ups, and status reports that keep teams aligned.",
    illustration: "operations",
  },
] as const;

export type DelegationIllustrationVariant = (typeof delegationTasks)[number]["illustration"];

export const services = [
  {
    title: "Administrative Support",
    description: "Inbox management, scheduling, documentation and research — with tracked hours and daily work summaries.",
    icon: Inbox,
    includes: [
      "Inbox triage and email management",
      "Scheduling and calendar coordination",
      "Document formatting and data entry",
      "Online research and summaries",
      "Tracked hours and daily work summaries",
    ],
  },
  {
    title: "Executive Assistance",
    description: "Executive-level support for founders and leadership teams, planned around your calendar and travel.",
    icon: CalendarCheck,
    includes: [
      "Complex calendar and travel planning",
      "Meeting agendas, notes and follow-ups",
      "Board and investor deck preparation",
      "Confidential correspondence handling",
      "Cover planning for travel, leave and busy periods",
    ],
  },
  {
    title: "Customer Support",
    description: "Email, live chat, phone, CRM and helpdesk coverage with conversation handovers and daily support summaries.",
    icon: Headphones,
    includes: [
      "Helpdesk and shared-inbox coverage",
      "Live chat, phone and website inquiry handling",
      "Order, billing and refund assistance",
      "Ticket triage and escalation",
      "CSAT tracking and conversation handovers",
    ],
  },
  {
    title: "Marketing Support",
    description: "Campaign coordination, social scheduling and reporting tied to tracked delivery.",
    icon: Megaphone,
    includes: [
      "Social media scheduling and engagement",
      "Campaign setup and coordination",
      "Community management",
      "Basic graphic design in Canva",
      "Monthly campaign reports tied to tracked activity",
    ],
  },
  {
    title: "Lead Generation",
    description: "Prospecting, outreach and pipeline updates with verified activity and weekly reports.",
    icon: Search,
    includes: [
      "ICP research and prospect list building",
      "LinkedIn and email outreach support",
      "CRM hygiene and pipeline updates",
      "Follow-up sequences and reminders",
      "Pipeline reports with verified outreach activity",
    ],
  },
  {
    title: "Website Management",
    description: "Website edits, publishing and maintenance with change logs and post-update checks.",
    icon: LayoutDashboard,
    includes: [
      "CMS updates (WordPress, Shopify, Webflow)",
      "Blog publishing and formatting",
      "Product and listing updates",
      "Desktop and mobile QA checks",
      "Change logs and post-update summaries",
    ],
  },
  {
    title: "Content Creation",
    description: "Blog drafts, newsletters, captions and design support with a clear approval workflow.",
    icon: PenTool,
    includes: [
      "Blog and article drafts in your voice",
      "Newsletters and email sequences",
      "Social captions and content calendars",
      "Presentations and one-pagers",
      "Approval workflow and revision logs",
    ],
  },
  {
    title: "Project Coordination",
    description: "SOPs, schedules and stakeholder follow-ups with weekly delivery reports.",
    icon: Workflow,
    includes: [
      "Task board setup and maintenance",
      "SOP documentation and process maps",
      "Status updates and team reminders",
      "Stakeholder follow-ups",
      "Weekly delivery reports and progress summaries",
    ],
  },
];

/**
 * What every client engagement includes beyond the task work itself.
 * Mirrors the delivery platform AVS runs engagements on: planned shifts,
 * verified attendance, screen-backed evidence, reports written for hiring
 * managers, and invoices built from recorded hours.
 */
export const deliveryPlatform = [
  {
    tag: "Scheduling",
    title: "Planned shifts & cover",
    description:
      "Your assistant works a schedule agreed in your time zone, with breaks, meetings and training blocked out — and cover planned before a gap reaches you.",
    icon: CalendarClock,
  },
  {
    tag: "Time tracking",
    title: "Verified attendance & hours",
    description:
      "Clock-in and clock-out, break and activity records, and automatic late, absence and overtime flags. You see the hours that were actually worked.",
    icon: Clock,
  },
  {
    tag: "Visibility",
    title: "Screen check-ins & activity proof",
    description:
      "Periodic screen check-ins and activity signals run only while an assistant is clocked in, so quality conversations are backed by what actually happened.",
    icon: MonitorCheck,
  },
  {
    tag: "Reporting",
    title: "Written shift reports",
    description:
      "After shifts, a plain-English report covers attendance, schedule adherence, productivity, what the screen evidence shows, risks and coaching.",
    icon: FileText,
  },
  {
    tag: "Insights",
    title: "Period reviews & recommendations",
    description:
      "Weekly or monthly reviews connect the pattern across shifts and give you clear recommendations for renewal, hours and staffing decisions.",
    icon: LineChart,
  },
  {
    tag: "Billing",
    title: "Invoice-ready timesheets",
    description:
      "Billing comes from the same recorded hours you can audit, with an itemised invoice issued at the agreed hourly rate.",
    icon: Receipt,
  },
  {
    tag: "Continuity",
    title: "Leave & continuity planning",
    description:
      "Leave and absence are requested and approved ahead of time, with a documented handover and cover so work keeps moving.",
    icon: CalendarCheck,
  },
  {
    tag: "Security",
    title: "Secure access & collaboration",
    description:
      "Role-based access, two-factor sign-in and account approval keep your workspace limited to the people who need it, with secure chat and video for the delivery team.",
    icon: ShieldCheck,
  },
] as const;

/** The sections hiring managers see in a written shift report. */
export const reportSections = [
  {
    title: "Attendance & punctuality",
    detail: "Start times, lateness bands, absences and overtime — with the evidence behind each flag.",
  },
  {
    title: "Time & schedule adherence",
    detail: "Scheduled versus worked time, breaks and meetings, so every hour is accounted for.",
  },
  {
    title: "Productivity & engagement",
    detail: "Activity signals and work patterns across the shift, not a single-screenshot judgement.",
  },
  {
    title: "Screen evidence story",
    detail: "A chronological summary of what the screen check-ins recorded during the shift.",
  },
  {
    title: "Risks & compliance",
    detail: "Break rules, missed starts, policy exceptions and anything that needs your attention.",
  },
  {
    title: "Coaching plan",
    detail: "Specific actions for the assistant and account manager before the next shift.",
  },
  {
    title: "Outlook & recommendations",
    detail: "What to expect next, plus recommendations for staffing, hours and priorities.",
  },
] as const;

export const pricingPlans = [
  {
    name: "Virtual Assistant",
    price: "£4.50",
    cadence: "/hr",
    summary: "Virtual assistant support with core administrative services included.",
    popular: true,
    features: [
      "Inbox & email management",
      "Scheduling & calendar coordination",
      "Documentation & research",
      "Daily operations support",
      "Planned shifts & verified hours",
      "Shift reports & itemised invoices",
      "Dedicated VA support",
    ],
  },
];

export const planInclusions = [
  "Scheduled shifts in your time zone",
  "Verified attendance and timesheets",
  "Screen check-ins during shifts",
  "Written shift reports and period reviews",
  "Leave approvals and planned cover",
  "Itemised invoice from recorded hours",
];

export const trustLogos = ["Founders", "Coaches", "Agencies", "eCommerce", "Real Estate", "SMEs", "SaaS", "Consultancies"];

export const processSteps = [
  {
    title: "Discovery Call",
    description:
      "A free consultation to map your goals, tools, time zone and the tasks you want off your plate — no commitment required.",
  },
  {
    title: "Assistant Matching",
    description:
      "We shortlist vetted assistants whose skills, experience and communication style fit how you work, and propose a shift pattern.",
  },
  {
    title: "Launch & Onboarding",
    description:
      "Meet your assistant, agree SOPs, tool access, working hours and reporting, then go live — most clients are running within 24–48 hours.",
  },
  {
    title: "Ongoing Support",
    description:
      "Shift reports, verified timesheets, itemised invoices and a dedicated account contact keep execution sharp as you scale.",
  },
];

export const values = [
  { title: "Qualified Individuals First", description: "We focus exclusively on intelligent individuals with strong drive and proven capability—not 'regular' workers. Our VAs bring cognitive depth, judgment, and contextual understanding that automation alone cannot provide." },
  { title: "Human-Centered Operations", description: "We believe in the persistent and vital need for actual workers with a brain. Our model combines human expertise, strategic thinking, and technology to deliver superior results." },
  { title: "AI as a Tool", description: "Artificial intelligence is transformative, but it cannot replicate human intellect. We strategically deploy AI to amplify our team's capabilities while keeping qualified, trained team members at the core of everything we do." },
  { title: "Trust Through Expertise", description: "High standards, careful vetting, and proven track records form the foundation of every partnership. You're working with true experts, not commoditized support." },
];

export const testimonials = [
  {
    quote:
      "I got my evenings back within the first week. My assistant runs my inbox and calendar so well that I stopped double-booking myself entirely.",
    name: "Maya Chen",
    role: "Founder, SaaS Studio",
    result: "15+ hours saved weekly",
    rating: 5,
  },
  {
    quote:
      "Their VA handled client onboarding, follow-ups, and CRM updates with the kind of consistency we couldn't get from freelancers. Our agency finally runs on process instead of panic.",
    name: "Andre Wilson",
    role: "Agency Owner",
    result: "Client response time cut by 60%",
    rating: 5,
  },
  {
    quote:
      "Between sessions, my assistant preps client materials, manages my community, and keeps my funnel moving. It feels like having a chief of staff on a coach's budget.",
    name: "Daniel Adeyemi",
    role: "Executive Coach",
    result: "2x coaching capacity",
    rating: 5,
  },
  {
    quote:
      "Order inquiries, returns, and supplier chase used to bury our small team. Now everything is handled overnight and we start each day caught up.",
    name: "Lena Ortiz",
    role: "eCommerce Operator",
    result: "Same-day support coverage",
    rating: 5,
  },
  {
    quote:
      "The matching process was scary accurate. Our assistant already knew the tools we use and suggested SOPs we hadn't thought of.",
    name: "Priya Sharma",
    role: "COO, Startup",
    result: "Onboarded in 48 hours",
    rating: 5,
  },
  {
    quote:
      "Lead lists, CRM hygiene, outreach follow-ups — the pipeline work I kept postponing for quarters is now just handled. Reports land every Friday without me asking.",
    name: "Tom Bradley",
    role: "Sales Director, B2B Services",
    result: "3x more qualified leads",
    rating: 5,
  },
];

export const caseStudies = [
  {
    industry: "Agency",
    headline: "From overloaded PMs to smooth client delivery",
    challenge: "A 6-person marketing agency was losing evenings to client follow-ups, reporting, and CRM upkeep.",
    outcome: "A dedicated VA took over scheduling, client comms, and weekly reports across 14 accounts.",
    metric: "14 client accounts run smoothly",
    icon: Handshake,
  },
  {
    industry: "Coach",
    headline: "More coaching hours, zero admin backlog",
    challenge: "An executive coach was spending 12+ hours a week on scheduling, session notes, and community management.",
    outcome: "Assistant now manages the calendar, prep packs, and follow-up sequences end to end.",
    metric: "12 hours returned weekly",
    icon: Sparkles,
  },
  {
    industry: "eCommerce",
    headline: "Overnight support for a growing store",
    challenge: "A Shopify brand's customer inquiries piled up across time zones, hurting reviews and repeat sales.",
    outcome: "VA team covers inquiries, returns, and supplier follow-ups with a daily handover summary.",
    metric: "Inquiries answered same-day",
    icon: ShoppingBag,
  },
  {
    industry: "Startup",
    headline: "Ops support without a full-time hire",
    challenge: "A seed-stage startup needed operational help but couldn't justify another full-time salary.",
    outcome: "A flexible-hours assistant handles research, data hygiene, and investor-update preparation.",
    metric: "Ops covered at a fraction of a hire",
    icon: Rocket,
  },
];

export const industries = [
  {
    name: "Founders & Executives",
    description: "Inbox, calendar, travel, and research so leadership time goes to strategy.",
    icon: Briefcase,
  },
  {
    name: "Marketing Agencies",
    description: "Client coordination, reporting, and campaign ops that keep accounts healthy.",
    icon: LineChart,
  },
  {
    name: "Coaches & Consultants",
    description: "Session prep, community management, and funnel follow-up between calls.",
    icon: MessageCircle,
  },
  {
    name: "eCommerce & Retail",
    description: "Customer service, order issues, listing updates, and supplier coordination.",
    icon: ShoppingBag,
  },
  {
    name: "Real Estate",
    description: "Listing coordination, inquiry handling, and database management.",
    icon: LayoutDashboard,
  },
  {
    name: "SaaS & Tech Teams",
    description: "Ops support, CRM hygiene, and customer success coverage that scales.",
    icon: BarChart3,
  },
  {
    name: "Professional Services",
    description: "Document prep, client intake, and billing support for busy practices.",
    icon: FileSearch,
  },
  {
    name: "Healthcare & Wellness",
    description: "Appointment scheduling, reminders, and front-desk admin handled remotely.",
    icon: HeartPulse,
  },
];

export const whyChooseUs = [
  {
    title: "Careful Assistant Matching",
    description: "We match on skills, tools, industry exposure, and communication style — not just availability.",
    icon: UsersRound,
  },
  {
    title: "Managed Onboarding",
    description: "A structured first week with SOPs, tool access, and clear ownership from day one.",
    icon: Rocket,
  },
  {
    title: "SOP-Driven Execution",
    description: "Your processes are documented and followed, so quality doesn't depend on memory.",
    icon: ClipboardList,
  },
  {
    title: "Quality Monitoring",
    description: "Account managers review shift evidence, attendance and activity scores, and coach assistants continuously.",
    icon: ShieldCheck,
  },
  {
    title: "Transparent Reporting",
    description: "Shift reports, attendance records and hours you can verify — no black boxes.",
    icon: LineChart,
  },
  {
    title: "Dedicated Support",
    description: "A consistent point of contact who knows your business, backed by our coverage team.",
    icon: Handshake,
  },
];

export const comparisonRows = [
  { label: "Recruitment time", inHouse: "4–8 weeks of advertising, screening, and interviews", avs: "Matched with a vetted assistant in 24–48 hours" },
  { label: "Training costs", inHouse: "Weeks of paid onboarding time before full productivity", avs: "Managed onboarding with SOPs from day one" },
  { label: "Employee overhead", inHouse: "Salary, tax, benefits, equipment, and office costs", avs: "One flexible hourly rate — £4.50/hr" },
  { label: "Scalability", inHouse: "Every new task means another hire", avs: "Scale hours up or down as workloads change" },
  { label: "Replacement support", inHouse: "Restart recruiting when someone leaves", avs: "Free replacement with warm handover, no downtime" },
  { label: "Time and attendance", inHouse: "Self-reported timesheets and manual checks", avs: "Clock-in/out, breaks, lateness and overtime recorded automatically" },
  { label: "Visibility into work", inHouse: "Updates arrive when someone remembers to send them", avs: "Shift reports, screen-backed evidence and planned schedules" },
  { label: "Management burden", inHouse: "Line management, reviews, and HR administration", avs: "We handle supervision, quality control, and reporting" },
];

export const resources = [
  {
    title: "The Delegation Guide",
    description: "A practical framework for deciding what to delegate first, with scripts for handing tasks off cleanly.",
    icon: ClipboardList,
  },
  {
    title: "VA Hiring Checklist",
    description: "The exact vetting criteria we use: skills tests, communication screens, and reference checks.",
    icon: CheckCircle2,
  },
  {
    title: "Productivity Toolkit",
    description: "Our favourite templates: weekly reports, SOP outlines, task handover docs, and inbox rules.",
    icon: Sparkles,
  },
];

export const faqs = [
  {
    question: "How quickly can we start?",
    answer:
      "Most clients are matched and live within 24–48 hours of the discovery call. In the first week we set up your shift schedule, SOPs, tool access and reporting cadence together, so your assistant starts with a clear plan rather than a blank page.",
  },
  {
    question: "How are assistants vetted?",
    answer:
      "Every assistant passes skills testing, written and verbal communication screens, tool assessments, reference checks and a paid trial. Fewer than one in ten applicants make it into our pool, and every assistant is briefed on your SOPs before their first shift.",
  },
  {
    question: "Do I get a dedicated assistant?",
    answer:
      "Yes. You work with one dedicated assistant who learns your business, tools and preferences, supported by our account management and cover team. If they are on leave or unwell, we arrange handover and cover so nothing stops.",
  },
  {
    question: "How is work planned and scheduled?",
    answer:
      "We agree a shift pattern in your time zone, including start and end times, breaks, meetings and training blocks. Schedules are planned in advance and can be adjusted through your account manager, so you always know when your assistant is working and what is covered.",
  },
  {
    question: "How do I know the hours I'm billed for were actually worked?",
    answer:
      "Every shift is recorded: clock-in and clock-out, breaks, meetings and activity events, with automatic flags for late starts, absences and overtime. Invoices are generated from those same recorded hours, so any line can be checked against the shift record.",
  },
  {
    question: "What reporting will I receive?",
    answer:
      "Written shift reports cover attendance, time and schedule adherence, productivity, what the screen evidence shows, risks and coaching. A weekly or monthly review connects the pattern across shifts and recommends next steps. Reports are written for hiring managers — short, evidence-led and decision-ready.",
  },
  {
    question: "Do you monitor your assistants' screens?",
    answer:
      "Yes, only while an assistant is clocked into a scheduled shift. We take periodic screen check-ins and activity signals, and authorised managers can open a live view during a shift for quality checks. They are used for quality assurance, security and the evidence behind your reports, and access is restricted by role and covered by confidentiality agreements.",
  },
  {
    question: "How do you keep quality consistent?",
    answer:
      "Work is SOP-driven, and account managers review shift evidence, attendance and activity scores against clear standards. Where something slips, the shift report names it and the coaching plan sets the fix — so quality is reviewed continuously, not saved for a quarterly review.",
  },
  {
    question: "What happens if my assistant is on leave or off sick?",
    answer:
      "Leave is requested and approved in advance, with a documented handover and planned cover. For unplanned absence we move quickly to cover the shift and brief the covering assistant on your SOPs, so you are not left chasing work.",
  },
  {
    question: "What if the fit isn't right?",
    answer:
      "If the fit isn't right — or someone moves on — we provide a free replacement with a structured warm handover: documented SOPs and a briefing so work continues without downtime. Your schedule, reporting history and SOPs stay with the account, so the new assistant starts with context.",
  },
  {
    question: "Can assistants use our software?",
    answer:
      "Yes. Assistants work inside your stack — Google Workspace, Slack, HubSpot, Shopify, Notion, Asana, Trello, Zoom and more — using secure, client-controlled access you can revoke at any time. Tool access is agreed and documented during onboarding.",
  },
  {
    question: "Can plans scale up or down?",
    answer:
      "Yes. Start with a few hours a week and scale up as trust and workload grow, or scale down in quiet periods. Because hours are scheduled and tracked, changing your plan is a matter of changing the shift pattern — not rehiring.",
  },
  {
    question: "How does billing and invoicing work?",
    answer:
      "You are billed at the agreed hourly rate — £4.50/hr for the Virtual Assistant plan — for the hours recorded in the shift system, with an itemised invoice issued each month. If a line doesn't look right, raise it with your account manager before paying and we will reconcile it against the shift record.",
  },
  {
    question: "Do you use AI?",
    answer:
      "AI is a tool, not a replacement for your assistant. It helps turn shift evidence into plain-English reports and highlight patterns across a period, while account managers make the quality and staffing decisions. Your assistant remains the person doing and owning the work.",
  },
  {
    question: "How is our data protected?",
    answer:
      "Access is role-based, two-factor sign-in is available across the account, and you control the access your assistant is given. Screen capture runs only during scheduled shifts, is restricted to authorised managers, and is handled under confidentiality agreements.",
  },
  {
    question: "Which industries do you support?",
    answer:
      "We support founders, agencies, coaches, eCommerce brands, real estate, SaaS teams, professional services, healthcare practices and legal teams for admin-only support. If your work is largely digital, we can almost certainly support it.",
  },
  {
    question: "Do you offer legal services or legal advice?",
    answer:
      "No. AVS is not a law firm, and legal and attorney services sit outside our expertise: we don't provide legal advice or opinions, review or draft contracts for legal risk, or represent anyone in a legal matter, and we don't have lawyers, solicitors, attorneys, barristers or paralegals on staff or on standby. If you need legal advice, please speak to a qualified lawyer licensed in the relevant jurisdiction — we can't recommend or refer firms. What we can do is support the admin around a legal matter: inbox and diary management, client intake, document formatting, bundle assembly and transcription, filing, and scheduling, all under the direction and sign-off of your own legal adviser.",
  },
];

export const assistantProfiles = [
  {
    name: "Operations VA",
    focus: "Inbox, scheduling, documentation",
    icon: ClipboardList,
  },
  {
    name: "Customer Support VA",
    focus: "Chat, email, CRM ticket updates",
    icon: Headphones,
  },
  {
    name: "Growth VA",
    focus: "Lead lists, outreach, reporting",
    icon: BarChart3,
  },
];

export const blogPosts = [
  {
    title: "How to Know When You're Ready for Virtual Assistant Support",
    category: "Delegation",
    excerpt: "A practical guide to spotting the repetitive work that is quietly limiting your growth.",
  },
  {
    title: "The Weekly Operating System for Remote Teams",
    category: "Remote Work",
    excerpt: "Simple rhythms that keep assistants, founders, and managers aligned without meeting overload.",
  },
  {
    title: "Seven Tasks Every Founder Should Stop Doing Manually",
    category: "Automation",
    excerpt: "A focused list of admin, CRM, and content workflows that can be delegated or systemized.",
  },
];

export const qualitySignals = [
  { label: "Vetted assistants", icon: ShieldCheck },
  { label: "Managed onboarding", icon: UsersRound },
  { label: "Verified hours", icon: Clock },
  { label: "Evidence-led reporting", icon: CheckCircle2 },
];

export const serviceGuarantees = [
  {
    title: "Dedicated Point of Contact",
    description:
      "Your assistant learns your business, processes and preferences, backed by an account manager who owns quality and reporting.",
    icon: UsersRound,
  },
  {
    title: "Clear Communication Protocols",
    description:
      "Agreed channels — secure chat, email and scheduled video — plus a direct escalation route to your account manager.",
    icon: MessageCircle,
  },
  {
    title: "Verified Hours & Reporting",
    description:
      "Every shift is time-stamped: shift reports, period reviews and invoices all come from the same recorded hours.",
    icon: LineChart,
  },
  {
    title: "Free Replacement Guarantee",
    description:
      "If the fit is not right, we re-match quickly with a warm handover of SOPs, schedule and account history.",
    icon: RefreshCcw,
  },
  {
    title: "Secure & Confidential",
    description:
      "Role-based access, two-factor sign-in, client-controlled permissions and screen checks that run only during shifts.",
    icon: ShieldCheck,
  },
  {
    title: "Continuous Optimization",
    description:
      "Attendance, adherence and activity scores feed a coaching plan reviewed with you each period.",
    icon: Clock,
  },
];

export const footerColumns = [
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Administrative Support", href: "/services" },
      { label: "Executive Assistance", href: "/services" },
      { label: "Customer Support", href: "/services" },
      { label: "Lead Generation", href: "/services" },
      { label: "All Services", href: "/services" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Delegation Guide", href: "/#resources" },
      { label: "VA Hiring Checklist", href: "/#resources" },
      { label: "Productivity Toolkit", href: "/#resources" },
      { label: "FAQs", href: "/#faq" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Founders & Executives", href: "/#industries" },
      { label: "Agencies", href: "/#industries" },
      { label: "Coaches & Consultants", href: "/#industries" },
      { label: "eCommerce", href: "/#industries" },
      { label: "All Industries", href: "/#industries" },
    ],
  },
];