/**
 * RAG knowledge base for the AVS website assistant.
 *
 * Facts come from the site's own content (lib/site-content.ts, page copy).
 * The question angles follow what virtual-assistance clients most often ask
 * (pricing structure, commitment terms, matching speed, time zones, security,
 * reporting, replacements, tools) — benchmarked against goldieva.com.
 */

export interface KnowledgeChunk {
  id: string;
  title: string;
  category: string;
  /** Extra terms that should boost this chunk when they appear in a query. */
  keywords?: string[];
  text: string;
}

export const knowledgeBase: KnowledgeChunk[] = [
  {
    id: "company-overview",
    title: "About Advanced Virtual Solutions",
    category: "About",
    keywords: ["avs", "advanced virtual solutions", "who are you", "about", "company", "agency", "trust", "legit"],
    text: "Advanced Virtual Solutions (AVS) provides dedicated virtual assistants for founders, agencies, coaches, eCommerce brands, and growing teams. AVS helps clients scale operations without increasing overhead, promising to save clients 20+ hours a week. Contact: admin@advancedvirtualsolutions.com, phone/WhatsApp +44 7882 615046. Support hours: UK/EU business hours, Monday to Friday. The company focuses on qualified, carefully vetted individuals with strong drive and proven capability, combining human expertise with AI as a supporting tool — never replacing trained team members with automation.",
  },
  {
    id: "getting-started",
    title: "How to get started and how to hire a VA",
    category: "Getting Started",
    keywords: ["start", "begin", "hire", "sign up", "onboarding", "process", "steps", "how do i", "book", "consultation", "discovery call"],
    text: "Getting started with AVS takes four steps: (1) Discovery Call — a free consultation to map your goals, tools, and the tasks you want off your plate, with no commitment required. (2) Assistant Matching — AVS shortlists vetted assistants whose skills, experience, and communication style fit how you work. (3) Launch & Onboarding — you meet your assistant, agree SOPs and channels, and go live; most clients are running within 24–48 hours. (4) Ongoing Support — weekly reporting, quality monitoring, and a dedicated account contact keep execution sharp as you scale. Book a free consultation through the website's contact page or by emailing admin@advancedvirtualsolutions.com.",
  },
  {
    id: "pricing",
    title: "Pricing and hourly rates",
    category: "Pricing",
    keywords: ["price", "pricing", "cost", "rate", "how much", "fees", "charge", "expensive", "affordable", "budget", "billing", "pay", "payment", "£", "per hour", "hourly"],
    text: "AVS charges one flexible hourly rate of £4.50 per hour for dedicated virtual assistant support. Billing is flexible hourly — you only pay for the support you actually use, and hours can scale up or down as workloads change. Pricing is transparent with no hidden costs. Compared with hiring in-house (salary, tax, benefits, equipment, office costs), the single £4.50/hr rate covers recruitment-free matching, managed onboarding, supervision, quality control, and reporting. For a tailored quote based on your task mix, book the free discovery call.",
  },
  {
    id: "commitment-terms",
    title: "Contracts, commitment, and scaling hours",
    category: "Pricing",
    keywords: ["contract", "commitment", "minimum", "lock-in", "cancel", "pause", "stop", "upgrade", "downgrade", "scale", "part-time", "full-time", "hours", "flexible"],
    text: "AVS plans are flexible: clients can start with a few hours a week and scale up as trust and workload grow, or scale down in quiet periods. Flexible hourly billing means you only pay for the support you actually use — no need for another hire every time a new task appears. Part-time or full-time level coverage is simply a matter of how many hours you book. Specific contract terms are confirmed on the free discovery call.",
  },
  {
    id: "services-overview",
    title: "Services overview",
    category: "Services",
    keywords: ["services", "offer", "what can you do", "what do you do", "help", "support", "tasks", "delegate"],
    text: "AVS offers eight service lines: Administrative Support, Executive Assistance, Customer Support, Marketing Support, Lead Generation, Website Management, Content Creation, and Project Coordination. Across these lines, clients commonly delegate inbox management, calendar management, customer support coverage, lead generation, CRM management, research, content support, and operations coordination. Over 300 projects have been delivered across these eight service lines.",
  },
  {
    id: "service-admin",
    title: "Administrative Support service",
    category: "Services",
    keywords: ["admin", "administrative", "inbox", "email", "calendar", "scheduling", "data entry", "documentation", "research"],
    text: "Administrative Support includes inbox triage and email management, scheduling and calendar coordination, document formatting and data entry, online research and summaries, and daily operations support. The goal is a tidy inbox where every priority is answered, flagged, or drafted for your review, and a calendar handled before it reaches your plate.",
  },
  {
    id: "service-executive",
    title: "Executive Assistance service",
    category: "Services",
    keywords: ["executive", "ea", "executive assistant", "travel", "meetings", "board", "investor", "confidential", "personal admin"],
    text: "Executive Assistance is dedicated executive-level support for busy founders and leadership teams. It includes complex calendar and travel planning, meeting agendas, notes, and follow-ups, board and investor deck preparation, confidential correspondence handling, and personal-admin support on request.",
  },
  {
    id: "service-customer-support",
    title: "Customer Support service",
    category: "Services",
    keywords: ["customer support", "customer service", "helpdesk", "live chat", "tickets", "csat", "refunds", "orders", "inbound", "calls"],
    text: "Customer Support provides reliable email, chat, CRM, and helpdesk support for better response times. It includes helpdesk and shared-inbox coverage, live chat responses during your hours, order, billing, and refund assistance, ticket triage and escalation, and CSAT tracking and reporting.",
  },
  {
    id: "service-marketing",
    title: "Marketing Support service",
    category: "Services",
    keywords: ["marketing", "social media", "social", "campaign", "community", "canva", "engagement", "instagram", "linkedin"],
    text: "Marketing Support covers campaign coordination, social media scheduling, engagement, and reporting. It includes social media scheduling and engagement, campaign setup and coordination, community management, basic graphic design in Canva, and monthly performance reports.",
  },
  {
    id: "service-lead-generation",
    title: "Lead Generation service",
    category: "Services",
    keywords: ["lead generation", "leads", "prospecting", "outreach", "linkedin outreach", "cold email", "pipeline", "sales", "crm hygiene"],
    text: "Lead Generation includes ICP research and prospect list building, LinkedIn and email outreach support, CRM hygiene and pipeline updates, follow-up sequences and reminders, and qualified lead handover notes. The goal is keeping your pipeline full with prospect research, list building, outreach, and follow-up.",
  },
  {
    id: "service-website",
    title: "Website Management service",
    category: "Services",
    keywords: ["website", "cms", "wordpress", "shopify", "webflow", "blog posting", "product updates", "maintenance", "plugins"],
    text: "Website Management covers website edits, blog posting, product updates, CMS entry, and maintenance support. It includes CMS updates in WordPress, Shopify, and Webflow, blog publishing and formatting, product and listing updates, basic QA across desktop and mobile, and plugin, app, and integration checks.",
  },
  {
    id: "service-content",
    title: "Content Creation service",
    category: "Services",
    keywords: ["content", "blog", "writing", "newsletters", "captions", "presentations", "design", "graphic", "email sequences"],
    text: "Content Creation includes blog and article drafts in your voice, newsletters and email sequences, social captions and content calendars, presentations and one-pagers, and Canva design support. Deliverables arrive ready for your approval.",
  },
  {
    id: "service-project",
    title: "Project Coordination service",
    category: "Services",
    keywords: ["project", "project management", "task board", "sop", "stakeholder", "workflow", "status updates", "operations"],
    text: "Project Coordination covers task boards, status updates, reminders, stakeholder follow-ups, and workflow tracking. It includes task board setup and maintenance, status updates and team reminders, stakeholder follow-ups, SOP documentation, and weekly progress reporting — keeping teams aligned with documented processes.",
  },
  {
    id: "industries",
    title: "Industries and clients served",
    category: "Industries",
    keywords: ["industries", "niche", "coaches", "agency", "agencies", "ecommerce", "e-commerce", "real estate", "saas", "healthcare", "founders", "startups", "business type"],
    text: "AVS supports founders and executives, marketing agencies, coaches and consultants, eCommerce and retail brands, real estate, SaaS and tech teams, professional services, and healthcare and wellness practices. If your work is largely digital, AVS can almost certainly support it. Example outcomes: a 6-person marketing agency had 14 client accounts run smoothly by a dedicated VA; an executive coach got 12 hours back weekly; a Shopify brand moved to same-day inquiry coverage; a seed-stage startup covered ops at a fraction of a full-time hire.",
  },
  {
    id: "vetting-quality",
    title: "How assistants are vetted and quality assured",
    category: "Quality",
    keywords: ["vetted", "vetting", "qualified", "quality", "screening", "experience", "skills", "trained", "trial", "references"],
    text: "Every AVS assistant passes a multi-stage vetting process: skills testing, written and verbal communication screens, tool assessments, reference checks, and a paid trial period. Fewer than one in ten applicants make it into the pool. Quality doesn't stop at matching — account managers review output regularly and coach assistants continuously, and execution is SOP-driven so quality doesn't depend on memory.",
  },
  {
    id: "dedicated-assistant",
    title: "Dedicated assistant model",
    category: "Service Model",
    keywords: ["dedicated", "one assistant", "same person", "my own va", "who works", "coverage", "sick", "away", "vacation", "backup"],
    text: "Yes — you work with one dedicated assistant who learns your business, tools, and preferences. They act as a consistent point of contact backed by AVS's account management and coverage team, so nothing stops when someone is off. Assistants become familiar with your business, processes, and preferences for seamless execution.",
  },
  {
    id: "tools-software",
    title: "Tools and software assistants can use",
    category: "Working With You",
    keywords: ["tools", "software", "stack", "apps", "google workspace", "slack", "hubspot", "notion", "asana", "trello", "zoom", "crm", "access"],
    text: "Assistants work inside your existing stack — Google Workspace, Slack, HubSpot, Shopify, Notion, Asana, Trello, Zoom, and more — using secure, client-controlled access that you can revoke at any time. During onboarding you agree the tools, SOPs, and channels your assistant will use.",
  },
  {
    id: "tracking-reporting",
    title: "Work tracking, hours, and reporting",
    category: "Working With You",
    keywords: ["track", "tracking", "report", "reporting", "timesheet", "hours worked", "accountability", "transparency", "activity log"],
    text: "You get a shared task board, daily or weekly activity logs, and a weekly summary of what was completed and what's next. Hours are tracked transparently and reported against your plan — task logs, weekly summaries, and hours you can verify, with no black boxes. AVS's average response time during agreed working hours is under 2 hours.",
  },
  {
    id: "replacement-guarantee",
    title: "What happens if the fit isn't right (free replacement)",
    category: "Guarantees",
    keywords: ["replacement", "not happy", "not satisfied", "wrong fit", "change assistant", "switch", "quit", "leave", "guarantee", "dissatisfied"],
    text: "If the fit isn't right — or someone moves on — AVS provides a free replacement with a structured warm handover: documented SOPs and a briefing so work continues without downtime. This mirrors the in-house alternative where restarting recruiting is on you; with AVS, re-matching is handled quickly at no extra cost.",
  },
  {
    id: "hours-saved-guarantee",
    title: "Time savings guarantee and track record",
    category: "Guarantees",
    keywords: ["guarantee", "hours saved", "results", "roi", "worth it", "satisfaction", "retention", "track record", "proof"],
    text: "AVS's headline promise: save 20+ hours a week — guaranteed. Clients average 20+ hours saved weekly after the first month. The track record: 10,000+ tasks completed and reported, 98% client satisfaction across ongoing engagements, a 95% client retention rate, and 300+ projects delivered. Testimonials report results like 15+ hours saved weekly (SaaS founder), client response time cut by 60% (agency owner), and 2x coaching capacity (executive coach).",
  },
  {
    id: "security-confidentiality",
    title: "Security, confidentiality, and NDAs",
    category: "Trust & Security",
    keywords: ["security", "secure", "confidential", "nda", "privacy", "data", "sensitive", "access", "safe", "ip", "intellectual property"],
    text: "AVS treats security and confidentiality as core guarantees: assistants operate with client-controlled access that you can revoke at any time, confidentiality agreements are in place, and your data is handled securely. Documented SOPs define exactly what the assistant may access and do.",
  },
  {
    id: "communication",
    title: "Communication channels and response times",
    category: "Working With You",
    keywords: ["communicate", "communication", "contact", "reach", "response time", "slack", "email", "whatsapp", "phone", "timezone", "time zone", "hours of coverage"],
    text: "AVS establishes agreed communication channels (Slack, email, Zoom) and frequency with each client to keep everything aligned. Average response time during agreed working hours is under 2 hours. Assistants work within your agreed working hours, so coverage aligns with your schedule. The AVS team itself operates UK/EU business hours, Monday to Friday, reachable at admin@advancedvirtualsolutions.com, +44 7882 615046, or WhatsApp.",
  },
  {
    id: "vs-inhouse",
    title: "AVS vs hiring in-house (comparison)",
    category: "Comparison",
    keywords: ["in-house", "inhouse", "employee", "hire someone", "freelancer", "compare", "comparison", "alternative", "why not", "overhead", "difference"],
    text: "Compared with hiring in-house: recruitment takes 4–8 weeks of advertising, screening, and interviews vs being matched with a vetted assistant in 24–48 hours; in-house carries weeks of paid onboarding vs AVS's managed onboarding with SOPs from day one; employees add salary, tax, benefits, equipment, and office costs vs one flexible £4.50/hr rate; scaling in-house means another hire for every new task vs scaling hours up or down; when someone leaves in-house you restart recruiting vs AVS's free replacement with warm handover; and in-house adds line management, reviews, and HR administration vs AVS handling supervision, quality control, and reporting.",
  },
  {
    id: "why-choose",
    title: "Why clients choose AVS",
    category: "About",
    keywords: ["why choose", "different", "unique", "best", "stand out", "advantage"],
    text: "Six reasons clients choose AVS: careful assistant matching on skills, tools, industry exposure, and communication style (not just availability); managed onboarding with a structured first week; SOP-driven execution so quality doesn't depend on memory; quality monitoring with account managers reviewing and coaching regularly; transparent reporting with verifiable task logs and hours; and dedicated support — one consistent point of contact backed by a coverage team.",
  },
  {
    id: "resources",
    title: "Free resources",
    category: "Resources",
    keywords: ["resources", "guide", "checklist", "toolkit", "templates", "ebook", "delegation guide", "free"],
    text: "AVS offers free resources: The Delegation Guide (a practical framework for deciding what to delegate first, with scripts for handing tasks off cleanly), the VA Hiring Checklist (the exact vetting criteria used: skills tests, communication screens, and reference checks), and the Productivity Toolkit (templates for weekly reports, SOP outlines, task handover docs, and inbox rules). These are available on the website's Resources section.",
  },
  {
    id: "blog",
    title: "Blog and thought leadership",
    category: "Resources",
    keywords: ["blog", "articles", "read", "learn"],
    text: "The AVS blog covers delegation and remote-operations topics, including 'How to Know When You're Ready for Virtual Assistant Support', 'The Weekly Operating System for Remote Teams', and 'Seven Tasks Every Founder Should Stop Doing Manually'.",
  },
  {
    id: "contact",
    title: "Contact details and booking",
    category: "Contact",
    keywords: ["contact", "email", "phone", "call", "whatsapp", "speak", "talk to human", "book", "consultation", "demo", "meeting"],
    text: "You can reach Advanced Virtual Solutions at admin@advancedvirtualsolutions.com, by phone or WhatsApp at +44 7882 615046, or through the contact page on the website. The team operates UK/EU business hours, Monday to Friday. The easiest next step is booking a free consultation (discovery call) — no commitment required. There is also a live human chat and a call button on the website.",
  },
  {
    id: "faq-how-quickly",
    title: "FAQ: How quickly can we start?",
    category: "FAQ",
    keywords: ["how quickly", "how fast", "start", "timeline", "when can", "urgent", "asap"],
    text: "Most clients are up and running within 24–48 hours of their discovery call. If your tasks involve trainable skills, your assistant can commence the following day. AVS handles onboarding, tool access, and SOPs with you in the first week.",
  },
  {
    id: "faq-matching",
    title: "FAQ: Do I choose or meet my assistant?",
    category: "FAQ",
    keywords: ["meet", "interview", "choose", "select", "match", "profiles", "approval"],
    text: "AVS shortlists vetted assistants whose skills, experience, and communication style fit how you work, and you meet your assistant as part of launch and onboarding — agreeing SOPs and channels before going live. The matching process considers skills, tools, industry exposure, and communication style, not just availability.",
  },
  {
    id: "faq-multiple-vas",
    title: "FAQ: Can I have more than one assistant or a team?",
    category: "FAQ",
    keywords: ["multiple", "team", "several", "more than one", "scale up", "grow"],
    text: "Yes. You can scale hours up as workload grows, and support can grow into a dedicated VA or team arrangement — Executive Support includes project and team coordination with workflow and operations management and performance oversight. Every engagement keeps a dedicated account contact.",
  },
  {
    id: "delegation-examples",
    title: "What tasks can I delegate? (examples)",
    category: "Services",
    keywords: ["delegate", "what tasks", "examples", "use cases", "off my plate", "busy", "overwhelmed"],
    text: "Tasks AVS clients commonly delegate: inbox management (every priority answered, flagged, or drafted), calendar management (scheduling, rescheduling, meeting prep), customer support (email, chat, helpdesk coverage), lead generation (prospect research, list building, outreach, follow-up), CRM management (clean records, updated deals, follow-up reminders), research (market scans, competitor summaries, vendor shortlists), content support (blog drafts, newsletters, captions, design files), and operations coordination (task boards, SOPs, vendor follow-ups, status reports).",
  },
];

export const suggestedQuestions = [
  "How much does a VA cost?",
  "How fast can we get started?",
  "What services do you offer?",
  "What if my assistant isn't a good fit?",
  "Can they work in my tools and time zone?",
  "How is work tracked and reported?",
  "Is my business data safe with you?",
  "How do I book a free consultation?",
];
