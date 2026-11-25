import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Clock, CreditCard, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import { ChatButton } from "@/components/chat-button";
import { FAQAccordion } from "@/components/faq-accordion";
import { MotionSection } from "@/components/motion-section";
import { PageFrame } from "@/components/page-frame";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  assistantProfiles,
  deliveryPlatform,
  faqs,
  industries,
  processSteps,
  reportSections,
  serviceGuarantees,
  services,
  site,
} from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Virtual Assistant Services",
  description:
    "Explore managed virtual assistant services with planned shifts, verified hours, screen-backed reporting and itemised invoicing — across administrative, executive, customer support, marketing, lead generation, website, content and project coordination.",
};

const serviceSpecs = [
  { icon: Clock, label: "Hours", detail: "Agreed shift patterns in your time zone, with breaks, meetings and coverage planned and tracked" },
  { icon: Wrench, label: "Tools", detail: "We work in your stack: Slack, HubSpot, Shopify, Notion, Asana, Trello, Google Workspace, and more" },
  { icon: UsersRound, label: "Team", detail: "One dedicated assistant, backed by an account manager and planned cover" },
  { icon: CreditCard, label: "Billing", detail: "£4.50/hr from recorded hours, with itemised invoices you can reconcile line by line" },
];

export default function ServicesPage() {
  return (
    <PageFrame
      eyebrow="Services"
      title="Virtual Assistant Services Built Around Growth"
      summary="Eight specialised service lines delivered by dedicated, vetted assistants — supported by managed onboarding, verified hours, SOP-driven execution and transparent reporting. Mix and match services as your needs change."
    >
      {/* Detailed services */}
      <MotionSection className="section-shell py-20">
        <SectionHeading
          eyebrow="What We Do"
          title="Dedicated Support Across Eight Service Lines"
          summary="Every service is delivered by your dedicated assistant and backed by our account management team."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card className="flex h-full flex-col transition hover:border-brand-blue/40 hover:shadow-soft" key={service.title}>
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-brand-blue">
                    <Icon size={22} />
                  </span>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-navy">{service.title}</h3>
                    <p className="text-sm text-slate-500">{service.description}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-cloud p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">What&apos;s included</p>
                  <ul className="mt-3 grid gap-2.5">
                    {service.includes.map((item) => (
                      <li className="flex items-start gap-2 text-sm leading-6 text-slate-700" key={item}>
                        <CheckCircle2 className="mt-1 shrink-0 text-brand-green" size={15} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-heading text-sm font-bold text-navy">From £4.50/hr</span>
                  <ChatButton size="sm">Discuss this service</ChatButton>
                </div>
              </Card>
            );
          })}
        </div>
      </MotionSection>

      {/* Guarantees — dark */}
      <section className="bg-navy py-20 text-white">
        <div className="section-shell">
          <SectionHeading
            dark
            eyebrow="Every Engagement"
            title="What You Get With Every Service"
            summary="Beyond task completion, you receive structured support, oversight, and continuous optimisation."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {serviceGuarantees.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-brand-green/40 hover:bg-white/10"
                  key={item.title}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-blue/20 text-brand-green">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-5 font-heading text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Delivery platform */}
      <MotionSection className="section-shell py-20">
        <SectionHeading
          eyebrow="Inside the Account"
          title="The Delivery System Behind Your Assistant"
          summary="You are not buying hours and hoping. Every engagement includes planned shifts, verified attendance, screen-backed evidence, written reports and itemised invoices."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deliveryPlatform.map((item) => {
            const Icon = item.icon;
            return (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={item.title}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-brand-blue">
                  <Icon size={20} />
                </span>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {item.tag}
                </p>
                <h3 className="mt-1 font-heading text-base font-bold text-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">
              Inside a shift report
            </p>
            <ul className="mt-5 grid gap-4">
              {reportSections.map((section) => (
                <li className="flex gap-3" key={section.title}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand-green" size={16} />
                  <div>
                    <p className="text-sm font-bold text-navy">{section.title}</p>
                    <p className="text-sm leading-6 text-slate-600">{section.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-navy p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-green">
              What lands in your inbox
            </p>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-300">
              <li>Shift reports with attendance, activity evidence and coaching notes</li>
              <li>A weekly or monthly review with recommendations for the next period</li>
              <li>An itemised invoice built from the hours recorded on shift</li>
              <li>Advance notice of leave, handover notes and the cover plan</li>
              <li>A direct line to your account manager for escalations</li>
            </ul>
            <p className="mt-6 text-xs font-semibold text-slate-400">
              You do not manage the system — we do. You get the evidence, the reports and the decisions.
            </p>
          </div>
        </div>
      </MotionSection>

      {/* Assistant profiles */}
      <MotionSection className="section-shell py-20">
        <SectionHeading
          eyebrow="Assistant Profiles"
          title="Matched to the Work You Need Done"
          summary="We shortlist specialists based on your workflow, tools, and communication style — then you meet them before anything starts."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {assistantProfiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <Card className="text-center transition hover:-translate-y-1 hover:border-brand-blue/40 hover:shadow-soft" key={profile.name}>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-navy text-white">
                  <Icon size={24} />
                </span>
                <h3 className="mt-5 font-heading text-xl font-bold text-navy">{profile.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{profile.focus}</p>
              </Card>
            );
          })}
        </div>
      </MotionSection>

      {/* Combinations + specs */}
      <section className="bg-cloud py-20">
        <div className="section-shell grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Popular Combinations"
              title="How Clients Bundle Services"
              summary="Most clients combine two or three services under one dedicated assistant."
            />
            <div className="mt-8 grid gap-4">
              {[
                {
                  title: "For Founders & Executives",
                  items: ["Executive Assistance", "Administrative Support", "Lead Generation"],
                },
                {
                  title: "For eCommerce & Agencies",
                  items: ["Customer Support", "Content Creation", "Marketing Support"],
                },
                {
                  title: "For Growth Teams",
                  items: ["Lead Generation", "Project Coordination", "Website Management"],
                },
              ].map((combo) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" key={combo.title}>
                  <h3 className="font-heading text-lg font-bold text-navy">{combo.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {combo.items.map((item) => (
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-brand-blue-dark" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-fit rounded-3xl border border-slate-200 bg-navy p-8 text-white lg:sticky lg:top-28">
            <h3 className="font-heading text-xl font-bold">Service Specifications</h3>
            <div className="mt-6 grid gap-5">
              {serviceSpecs.map((spec) => {
                const Icon = spec.icon;
                return (
                  <div className="flex gap-3" key={spec.label}>
                    <Icon className="mt-0.5 shrink-0 text-brand-green" size={18} />
                    <p className="text-sm leading-6 text-slate-300">
                      <span className="font-bold text-white">{spec.label}: </span>
                      {spec.detail}
                    </p>
                  </div>
                );
              })}
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-brand-green" size={18} />
                <p className="text-sm leading-6 text-slate-300">
                  <span className="font-bold text-white">Onboarding: </span>
                  shift schedule, SOPs, tool access and reporting set up in week one
                </p>
              </div>
            </div>
            <Button asChild className="mt-8 w-full" variant="green">
              <Link href="/pricing">See Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Industries */}
      <MotionSection className="section-shell py-20">
        <SectionHeading
          eyebrow="Industries"
          title="Services That Fit Your Sector"
          summary="Assistants with sector experience deliver faster from day one."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map((industry) => {
            const Icon = industry.icon;
            return (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={industry.name}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand-green-dark">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-navy">{industry.name}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{industry.description}</p>
              </div>
            );
          })}
        </div>
      </MotionSection>

      {/* Onboarding process */}
      <section className="bg-cloud py-20">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Onboarding"
            title="From Discovery Call to Delegation in Four Steps"
          />
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step, index) => (
              <li className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" key={step.title}>
                <span className="font-heading text-4xl font-extrabold text-brand-blue/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-heading text-lg font-bold text-navy">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <MotionSection className="section-shell py-20">
        <SectionHeading
          eyebrow="FAQ"
          title="Service Questions, Answered"
          summary="The details most clients want before choosing their service mix."
        />
        <div className="mx-auto mt-12 max-w-3xl">
          <FAQAccordion
            items={faqs.filter((faq) =>
              [
                "How is work planned and scheduled?",
                "What reporting will I receive?",
                "Do you monitor your assistants' screens?",
                "How do you keep quality consistent?",
                "What happens if my assistant is on leave or off sick?",
                "Can assistants use our software?",
                "Which industries do you support?",
                "Do you offer legal services or legal advice?",
              ].includes(faq.question),
            )}
          />
        </div>
      </MotionSection>

      {/* CTA */}
      <section className="section-shell pb-20">
        <div className="rounded-[2rem] bg-navy p-8 text-center text-white md:p-14">
          <h2 className="mx-auto max-w-2xl font-heading text-3xl font-extrabold text-balance md:text-4xl">
            Not Sure Which Services You Need?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-300">
            Book a free consultation and we&apos;ll map your workload to the right service mix —
            and to the right assistant.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ChatButton size="lg">Book Free Consultation</ChatButton>
            <Button asChild size="lg" variant="secondary">
              <Link href="/contact">Send Us A Message</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm font-semibold text-slate-400">
            Prefer instant answers? WhatsApp us at {site.phoneDisplay}
          </p>
        </div>
      </section>
    </PageFrame>
  );
}
