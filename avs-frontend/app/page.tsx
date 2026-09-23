import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { CallButton } from "@/components/call-button";
import { ChatButton } from "@/components/chat-button";
import { ComparisonTable } from "@/components/comparison-table";
import { DelegationIllustration } from "@/components/delegation-illustrations";
import { FAQAccordion } from "@/components/faq-accordion";
import { FloatingChat } from "@/components/floating-chat";
import { HeroDashboard } from "@/components/hero-dashboard";
import { MotionSection } from "@/components/motion-section";
import { SectionHeading } from "@/components/section-heading";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  caseStudies,
  delegationTasks,
  faqs,
  heroContent,
  industries,
  metrics,
  processSteps,
  resources,
  services,
  site,
  testimonials,
  trustLogos,
  whyChooseUs,
} from "@/lib/site-content";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        {/* Hero */}
        <section className="relative overflow-hidden bg-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-blue/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-40 h-[420px] w-[420px] rounded-full bg-brand-green/10 blur-3xl"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <Image
              src="/images/hero-support-agent.jpg"
              alt=""
              fill
              sizes="100vw"
              className="scale-[1.08] object-cover opacity-[0.17] blur-[5px]"
              style={{
                maskImage:
                  "radial-gradient(ellipse 95% 90% at 50% 45%, black 42%, transparent 82%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 95% 90% at 50% 45%, black 42%, transparent 82%)",
              }}
            />
          </div>
          <div className="section-shell relative grid items-center gap-14 py-16 lg:min-h-[calc(100vh-120px)] lg:grid-cols-2 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-blue-dark">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
                </span>
                {heroContent.eyebrow}
              </span>
              <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.06] tracking-tight text-navy text-balance md:text-6xl">
                {heroContent.headline}{" "}
                <span className="text-brand-blue">{heroContent.headlinePromise}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">{heroContent.subheadline}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <ChatButton size="lg">{heroContent.primaryCta}</ChatButton>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/services">{heroContent.secondaryCta}</Link>
                </Button>
              </div>

              <ul className="mt-8 grid grid-cols-2 gap-3 text-sm font-semibold text-navy sm:grid-cols-4">
                {heroContent.microTrust.map((item) => (
                  <li className="flex items-center gap-2" key={item}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100">
                      <svg aria-hidden="true" viewBox="0 0 12 10" className="h-2.5 w-2.5 fill-brand-green-dark">
                        <path d="M4.4 9.4 0 5l1.4-1.4 3 3L10.6.6 12 2z" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <MotionSection className="pb-8 lg:pb-0">
              <HeroDashboard />
            </MotionSection>
          </div>
        </section>

        {/* Trusted by */}
        <section className="border-y border-slate-200 bg-cloud py-10">
          <div className="section-shell">
            <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              Trusted by growing businesses
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-slate-500">
              {trustLogos.map((logo) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 tracking-wide"
                  key={logo}
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Metrics */}
        <MotionSection className="section-shell py-20">
          <SectionHeading
            eyebrow="Proven Results"
            title="Results That Compound"
            summary="Every delegated task turns into time back for your team. Here is what that looks like across our client base."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <Card className="text-center transition hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-soft" key={metric.label}>
                <p className="font-heading text-4xl font-extrabold text-navy md:text-5xl">{metric.value}</p>
                <p className="mt-2 font-heading text-sm font-bold uppercase tracking-wide text-brand-blue">{metric.label}</p>
                <p className="mt-2 text-sm text-slate-500">{metric.detail}</p>
              </Card>
            ))}
          </div>
        </MotionSection>

        {/* Delegation — dark section */}
        <section className="bg-navy py-20 text-white">
          <div className="section-shell">
            <SectionHeading
              dark
              eyebrow="Delegation"
              title="Imagine Never Handling These Tasks Again"
              summary="Hand us the recurring work that eats your week. Your dedicated assistant takes it on inside your tools, your processes, and your standards."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {delegationTasks.map((task) => (
                <div
                  className="group rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:-translate-y-1 hover:border-brand-green/40 hover:bg-white/10"
                  key={task.title}
                >
                  <div className="grid h-32 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent transition group-hover:border-brand-green/30">
                    <DelegationIllustration variant={task.illustration} className="h-24 w-full px-6" />
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-bold">{task.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{task.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button asChild size="lg" variant="green">
                <Link href="/services">Explore All Services</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Service categories */}
        <MotionSection className="section-shell py-20">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              align="left"
              eyebrow="Services"
              title="Virtual Assistant Services Built Around Growth"
              summary="Eight service lines, one dedicated assistant, flexible hourly plans that scale with you."
            />
            <Button asChild variant="secondary" className="shrink-0">
              <Link href="/services">View all services</Link>
            </Button>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Link
                  aria-label={`Learn more about ${service.title}`}
                  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue"
                  href="/services"
                  key={service.title}
                >
                  <Card className="group flex h-full flex-col transition hover:-translate-y-1 hover:border-brand-blue/40 hover:shadow-soft">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-brand-blue transition group-hover:bg-brand-blue group-hover:text-white">
                      <Icon size={20} />
                    </span>
                    <h3 className="mt-5 font-heading text-lg font-bold text-navy">{service.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
                    <span className="mt-4 text-sm font-bold text-brand-blue">Learn more →</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        </MotionSection>

        {/* Why choose us */}
        <section className="bg-cloud py-20">
          <div className="section-shell grid items-center gap-12 lg:grid-cols-2">
            <div className="relative">
              <div className="overflow-hidden rounded-[2rem] shadow-soft">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80"
                  alt="A virtual assistant collaborating with a client over a video call"
                  width={1200}
                  height={900}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:right-8">
                <p className="font-heading text-2xl font-extrabold text-navy">&lt; 1 in 10</p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">applicants make it through vetting</p>
              </div>
            </div>
            <div>
              <SectionHeading
                align="left"
                eyebrow="Why Choose Us"
                title="More Than Extra Hands. A Managed Delivery System."
                summary="Anyone can find an assistant. We build the matching, onboarding, and quality control around them so results don't depend on luck."
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {whyChooseUs.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={item.title}>
                      <Icon className="text-brand-blue" size={20} />
                      <h3 className="mt-3 font-heading text-base font-bold text-navy">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <MotionSection className="section-shell py-20">
          <SectionHeading
            eyebrow="The Comparison"
            title="Hiring In-House vs Using Advanced Virtual Solutions"
            summary="Same ownership of the work — without the recruiting cycles, overhead, and management load of another employee."
          />
          <div className="mt-12">
            <ComparisonTable />
          </div>
          <p className="mt-4 text-center text-xs font-semibold text-slate-400">
            Comparison assumes a full-time, UK-based administrative hire.
          </p>
        </MotionSection>

        {/* Process */}
        <section className="bg-cloud py-20">
          <div className="section-shell">
            <SectionHeading
              eyebrow="How It Works"
              title="Getting Started Takes Minutes"
              summary="From first call to a fully launched assistant in days — most clients are delegating within 48 hours."
            />
            <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step, index) => (
                <li className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" key={step.title}>
                  <span className="font-heading text-4xl font-extrabold text-brand-blue/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-heading text-lg font-bold text-navy">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  {index < processSteps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white lg:flex"
                    >
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <ChatButton size="lg">Book Free Consultation</ChatButton>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <MotionSection className="section-shell py-20">
          <SectionHeading
            eyebrow="Testimonials"
            title="What Clients Say"
            summary="Real feedback from founders, agency owners, coaches, and operators who handed us the busywork."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card className="flex h-full flex-col" key={testimonial.name}>
                <div className="flex gap-1" aria-label={`${testimonial.rating} out of 5 stars`}>
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star aria-hidden="true" className="fill-amber-400 text-amber-400" key={i} size={16} />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-base leading-7 text-slate-700">“{testimonial.quote}”</p>
                <span className="mt-4 inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-brand-green-dark">
                  {testimonial.result}
                </span>
                <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                    {testimonial.name.split(" ").map((part) => part[0]).join("")}
                  </span>
                  <div>
                    <strong className="block text-sm text-navy">{testimonial.name}</strong>
                    <span className="text-xs font-semibold text-slate-500">{testimonial.role}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </MotionSection>

        {/* Case studies */}
        <section className="bg-cloud py-20">
          <div className="section-shell">
            <SectionHeading
              eyebrow="Case Studies"
              title="Real Business Outcomes"
              summary="A look at how different businesses put dedicated support to work."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {caseStudies.map((study) => {
                const Icon = study.icon;
                return (
                  <Card className="flex h-full flex-col transition hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-soft" key={study.industry}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue-dark">
                        {study.industry}
                      </span>
                      <Icon className="text-brand-blue" size={22} />
                    </div>
                    <h3 className="mt-4 font-heading text-xl font-bold text-navy">{study.headline}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      <strong className="font-semibold text-navy">Challenge:</strong> {study.challenge}
                    </p>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                      <strong className="font-semibold text-navy">What we did:</strong> {study.outcome}
                    </p>
                    <p className="mt-5 inline-flex w-fit rounded-xl bg-navy px-4 py-2 font-heading text-sm font-bold text-brand-green">
                      {study.metric}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Industries */}
        <MotionSection className="section-shell py-20">
          <div id="industries" className="scroll-mt-28">
            <SectionHeading
              eyebrow="Industries"
              title="Support Shaped Around Your Industry"
              summary="Assistants matched with sector experience, so the learning curve is measured in days — not months."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {industries.map((industry) => {
                const Icon = industry.icon;
                return (
                  <div
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-green/40 hover:shadow-card"
                    key={industry.name}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand-green-dark">
                      <Icon size={19} />
                    </span>
                    <h3 className="mt-4 font-heading text-base font-bold text-navy">{industry.name}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{industry.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </MotionSection>

        {/* Resources */}
        <section className="bg-cloud py-20" id="resources-wrap">
          <div id="resources" className="section-shell scroll-mt-28">
            <SectionHeading
              eyebrow="Free Resources"
              title="Delegate Smarter, Starting Today"
              summary="Practical guides built from what actually works across hundreds of client engagements."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {resources.map((resource) => {
                const Icon = resource.icon;
                return (
                  <Card className="flex h-full flex-col transition hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-soft" key={resource.title}>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-brand-blue">
                      <Icon size={20} />
                    </span>
                    <h3 className="mt-5 font-heading text-lg font-bold text-navy">{resource.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{resource.description}</p>
                    <Link
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-blue transition hover:gap-2.5"
                      href="/contact"
                    >
                      Get it free
                      <span aria-hidden="true">→</span>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ — 2 column */}
        <section className="section-shell py-20" id="faq-wrap">
          <div id="faq" className="scroll-mt-28">
            <SectionHeading
              eyebrow="FAQ"
              title="Frequently Asked Questions"
              summary="Everything clients usually ask before their first consultation. Something else on your mind? Ask us directly."
            />
            <div className="mt-12 grid items-start gap-8 lg:grid-cols-2">
              <FAQAccordion items={faqs.slice(0, 4)} />
              <FAQAccordion items={faqs.slice(4)} />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-navy py-20 text-white">
          <div className="section-shell">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
                Ready To Reclaim Your Time?
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Book a free consultation and get a personalised delegation plan for your business —
                no commitment, no pressure.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <ChatButton size="lg">Book Free Consultation</ChatButton>
                <CallButton size="lg" variant="secondary">
                  Talk To Our Team
                </CallButton>
                <Button asChild size="lg" variant="green">
                  <Link href={site.whatsapp} target="_blank" rel="noreferrer">
                    Chat On WhatsApp
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <FloatingChat />
      <SiteFooter />
    </>
  );
}
