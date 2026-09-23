import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  Handshake,
  Headphones,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageCircle,
  PenTool,
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
    "Dedicated virtual assistants helping founders, agencies, coaches, eCommerce brands, and growing teams scale operations without increasing overhead.",
  primaryCta: "Book Free Consultation",
  secondaryCta: "Explore Services",
  microTrust: ["Dedicated Assistants", "Fast Onboarding", "Flexible Plans", "Global Support"],
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
    description: "Inbox management, scheduling, documentation, research, and daily operations support.",
    icon: Inbox,
    includes: [
      "Inbox triage and email management",
      "Scheduling and calendar coordination",
      "Document formatting and data entry",
      "Online research and summaries",
      "Daily operations support",
    ],
  },
  {
    title: "Executive Assistance",
    description: "Dedicated executive-level assistance for busy founders and leadership teams.",
    icon: CalendarCheck,
    includes: [
      "Complex calendar and travel planning",
      "Meeting agendas, notes, and follow-ups",
      "Board and investor deck preparation",
      "Confidential correspondence handling",
      "Personal-admin support on request",
    ],
  },
  {
    title: "Customer Support",
    description: "Reliable email, chat, CRM, and helpdesk support for better response times.",
    icon: Headphones,
    includes: [
      "Helpdesk and shared-inbox coverage",
      "Live chat responses during your hours",
      "Order, billing, and refund assistance",
      "Ticket triage and escalation",
      "CSAT tracking and reporting",
    ],
  },
  {
    title: "Marketing Support",
    description: "Campaign coordination, social media scheduling, engagement, and reporting.",
    icon: Megaphone,
    includes: [
      "Social media scheduling and engagement",
      "Campaign setup and coordination",
      "Community management",
      "Basic graphic design in Canva",
      "Monthly performance reports",
    ],
  },
  {
    title: "Lead Generation",
    description: "Prospecting, outreach lists, pipeline updates, CRM hygiene, and follow-up support.",
    icon: Search,
    includes: [
      "ICP research and prospect list building",
      "LinkedIn and email outreach support",
      "CRM hygiene and pipeline updates",
      "Follow-up sequences and reminders",
      "Qualified lead handover notes",
    ],
  },
  {
    title: "Website Management",
    description: "Website edits, blog posting, product updates, CMS entry, and maintenance support.",
    icon: LayoutDashboard,
    includes: [
      "CMS updates (WordPress, Shopify, Webflow)",
      "Blog publishing and formatting",
      "Product and listing updates",
      "Basic QA across desktop and mobile",
      "Plugin, app, and integration checks",
    ],
  },
  {
    title: "Content Creation",
    description: "Blog drafts, captions, presentations, newsletters, briefs, and Canva design support.",
    icon: PenTool,
    includes: [
      "Blog and article drafts in your voice",
      "Newsletters and email sequences",
      "Social captions and content calendars",
      "Presentations and one-pagers",
      "Canva design support",
    ],
  },
  {
    title: "Project Coordination",
    description: "Task boards, status updates, reminders, stakeholder follow-ups, and workflow tracking.",
    icon: Workflow,
    includes: [
      "Task board setup and maintenance",
      "Status updates and team reminders",
      "Stakeholder follow-ups",
      "SOP documentation",
      "Weekly progress reporting",
    ],
  },
];

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
      "Flexible hourly billing",
      "Dedicated VA support",
    ],
  },
];

export const trustLogos = ["Founders", "Coaches", "Agencies", "eCommerce", "Real Estate", "SMEs", "SaaS", "Consultancies"];

export const processSteps = [
  {
    title: "Discovery Call",
    description:
      "A free consultation to map your goals, tools, and the tasks you want off your plate — no commitment required.",
  },
  {
    title: "Assistant Matching",
    description:
      "We shortlist vetted assistants whose skills, experience, and communication style fit how you work.",
  },
  {
    title: "Launch & Onboarding",
    description:
      "Meet your assistant, agree SOPs and channels, and go live — most clients are running within 24–48 hours.",
  },
  {
    title: "Ongoing Support",
    description:
      "Weekly reporting, quality monitoring, and a dedicated account contact keep execution sharp as you scale.",
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
    description: "Account managers review output regularly and coach assistants continuously.",
    icon: ShieldCheck,
  },
  {
    title: "Transparent Reporting",
    description: "Task logs, weekly summaries, and hours you can verify — no black boxes.",
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
      "Most clients are up and running within 24–48 hours of their discovery call. If your tasks involve trainable skills, your assistant can commence the following day, and we handle onboarding, tool access, and SOPs with you in the first week.",
  },
  {
    question: "How are assistants vetted?",
    answer:
      "Every assistant passes a multi-stage process: skills testing, written and verbal communication screens, tool assessments, reference checks, and a paid trial period. Fewer than one in ten applicants make it into our pool.",
  },
  {
    question: "Do I get a dedicated assistant?",
    answer:
      "Yes. You work with one dedicated assistant who learns your business, tools, and preferences — supported by our account management and coverage team so nothing stops when someone is off.",
  },
  {
    question: "Can assistants use our software?",
    answer:
      "Absolutely. Assistants work inside your stack — Google Workspace, Slack, HubSpot, Shopify, Notion, Asana, Trello, Zoom, and more — using secure, client-controlled access that you can revoke at any time.",
  },
  {
    question: "How is work tracked?",
    answer:
      "You get a shared task board, daily or weekly activity logs, and a weekly summary of what was completed and what's next. Hours are tracked transparently and reported against your plan.",
  },
  {
    question: "What happens if we need a replacement?",
    answer:
      "If the fit isn't right — or someone moves on — we provide a free replacement with a structured warm handover: documented SOPs and a briefing so work continues without downtime.",
  },
  {
    question: "What industries do you support?",
    answer:
      "We support founders, agencies, coaches, eCommerce brands, real estate, SaaS teams, professional services, and healthcare practices. If your work is largely digital, we can almost certainly support it.",
  },
  {
    question: "Can plans scale?",
    answer:
      "Yes. Start with a few hours a week and scale up as trust and workload grow — or scale down in quiet periods. Flexible hourly billing means you only pay for the support you actually use.",
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
  { label: "Process-first execution", icon: Workflow },
  { label: "Productivity reporting", icon: CheckCircle2 },
];

export const serviceGuarantees = [
  {
    title: "Dedicated Point of Contact",
    description: "Your VA becomes familiar with your business, processes, and preferences for seamless execution.",
    icon: UsersRound,
  },
  {
    title: "Clear Communication Protocols",
    description: "We establish agreed channels (Slack, email, Zoom) and frequency to keep everything aligned.",
    icon: MessageCircle,
  },
  {
    title: "Weekly Reporting & Tracking",
    description: "You always know what's being handled and what's completed with transparent task documentation.",
    icon: LineChart,
  },
  {
    title: "Free Replacement Guarantee",
    description: "If the fit isn't right, we re-match you quickly with a structured warm handover.",
    icon: RefreshCcw,
  },
  {
    title: "Secure & Confidential",
    description: "Client-controlled access, confidentiality agreements, and secure handling of your data.",
    icon: ShieldCheck,
  },
  {
    title: "Continuous Optimization",
    description: "We refine processes based on results and feedback to maximize your team's productivity.",
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
