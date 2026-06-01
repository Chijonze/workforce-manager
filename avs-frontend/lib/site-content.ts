import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Headphones,
  Inbox,
  LayoutDashboard,
  Megaphone,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";

export const site = {
  name: "Advanced Virtual Solutions",
  domain: "https://advancedvirtualsolutions.com",
  email: "hello@advancedvirtualsolutions.com",
  phone: "+4407882650139",
  address: "31 Northfield Road, London, England, N16 5RL",
  calendly: process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/advancedvirtualsolutions/consultation",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/447882650139",
};

export const navigation = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "Get Started", href: "/hire" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const services = [
  {
    title: "Administrative Support",
    description: "Inbox management, scheduling, documentation, research, and daily operations support.",
    icon: Inbox,
  },
  {
    title: "Executive Assistance",
    description: "Dedicated executive-level assistance for busy professionals, founders, and leadership teams.",
    icon: CalendarCheck,
  },
  {
    title: "Social Media Management",
    description: "Content scheduling, engagement, brand coordination, community support, and reporting.",
    icon: Megaphone,
  },
  {
    title: "Customer Support",
    description: "Reliable email, chat, CRM, and helpdesk support for better response times.",
    icon: Headphones,
  },
  {
    title: "Lead Generation",
    description: "Prospecting, outreach lists, pipeline updates, CRM hygiene, and follow-up support.",
    icon: Search,
  },
  {
    title: "Website Management",
    description: "Website edits, blog posting, product updates, CMS entry, and maintenance support.",
    icon: LayoutDashboard,
  },
  {
    title: "Content Creation",
    description: "Blog drafts, captions, presentations, newsletters, briefs, and Canva design support.",
    icon: PenTool,
  },
  {
    title: "Project Coordination",
    description: "Task boards, status updates, reminders, stakeholder follow-ups, and workflow tracking.",
    icon: Workflow,
  },
];

export const pricingPlans = [
  {
    name: "Virtual Assistant",
    price: "$4.50",
    cadence: "/hr",
    summary: "Professional virtual assistant support with core administrative services included.",
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

export const stats = [
  { value: "42%", label: "average admin time recovered" },
  { value: "24/7", label: "remote operational coverage" },
  { value: "5 days", label: "typical onboarding window" },
  { value: "97%", label: "client satisfaction target" },
];

export const trustLogos = ["Founders", "Coaches", "Agencies", "eCommerce", "Real Estate", "SMEs"];

export const processSteps = [
  {
    title: "Tell us what slows you down",
    description: "Complete a focused intake so we understand your workflow, tools, budget, and preferred skills.",
  },
  {
    title: "Get matched with the right VA",
    description: "We shortlist trained assistants with the communication style and experience your business needs.",
  },
  {
    title: "Launch with managed support",
    description: "Start with clear SOPs, task tracking, reporting, and a support layer that keeps execution tight.",
  },
];

export const values = [
  { title: "AI as a Tool, Not a Replacement", description: "Artificial intelligence is transformative, but it cannot replicate human intellect. We strategically deploy AI to amplify our team's capabilities while keeping qualified, trained professionals at the core of everything we do." },
  { title: "Qualified Professionals First", description: "We focus exclusively on intelligent individuals with strong drive and proven capability—not 'regular' workers. Our VAs bring cognitive depth, judgment, and contextual understanding that automation alone cannot provide." },
  { title: "Human-Centered Operations", description: "We believe in the persistent and vital need for actual workers with a brain. Our model combines human expertise, strategic thinking, and technology to deliver superior results." },
  { title: "Trust Through Expertise", description: "Professional standards, careful vetting, and proven track records form the foundation of every partnership. You're working with true professionals, not commoditized support." },
];

export const testimonials = [
  {
    quote: "Advanced Virtual Solutions gave our leadership team back the hours we needed to focus on sales and product.",
    name: "Maya Chen",
    role: "Founder, SaaS Studio",
  },
  {
    quote: "Their VA handled inbox, customer follow-up, and CRM updates with the kind of consistency we were missing.",
    name: "Andre Wilson",
    role: "Agency Director",
  },
  {
    quote: "The onboarding was simple, the reporting was clear, and the assistant felt like part of our team quickly.",
    name: "Lena Ortiz",
    role: "eCommerce Operator",
  },
];

export const faqs = [
  {
    question: "How quickly can we start?",
    answer: "Most clients can begin within five business days after the intake form, role scoping, and assistant match are complete.",
  },
  {
    question: "Can I request a VA with specific tools experience?",
    answer: "Yes. You can request experience with tools like Google Workspace, Slack, HubSpot, Shopify, Zoom, Notion, Asana, Trello, or other systems.",
  },
  {
    question: "How do you track work?",
    answer: "We use task lists, weekly summaries, documented priorities, and agreed communication channels so clients always know what is moving.",
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
  { label: "Automation aware", icon: Sparkles },
];
