import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Globe2, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";
import { FloatingChat } from "@/components/floating-chat";
import { MotionSection } from "@/components/motion-section";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FAQAccordion } from "@/components/faq-accordion";
import {
  assistantProfiles,
  pricingPlans,
  processSteps,
  qualitySignals,
  services,
  stats,
  testimonials,
  trustLogos,
  site,
} from "@/lib/site-content";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-30">
            <Image
              src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1800&q=85"
              alt="Experienced team working on business operations"
              fill
              priority
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" />

          <div className="section-shell relative grid min-h-[calc(100vh-80px)] items-center gap-12 py-20 lg:grid-cols-[1fr_460px]">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                Advanced Virtual Solutions
              </span>
              <h1 className="mt-7 max-w-4xl font-heading text-5xl font-extrabold leading-[1.02] tracking-tight text-balance md:text-7xl">
                Virtual Assistant Support for Your Business
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                Reliable, and technology-driven virtual assistance for businesses
                that need sharper operations, faster response times, and more room to grow.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/hire">
                    Get Started
                    <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href={site.voiceCall}>
                    <PhoneCall size={18} />
                    Call Now
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/contact">Book Free Consultation</Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 text-sm font-semibold text-slate-200 sm:grid-cols-2 lg:grid-cols-5">
                {["24/7 Remote Support", "Dedicated Assistants", "Affordable Plans", "Fast Onboarding", "Global Coverage"].map(
                  (item) => (
                    <span className="inline-flex items-center gap-2" key={item}>
                      <CheckCircle2 className="text-cyan-300" size={16} />
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="dashboard-glow rounded-[2rem] border border-white/10 p-4 shadow-soft">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-white p-5 text-slate-950">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        Live
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {["Inbox", "CRM", "Support"].map((item, index) => (
                        <div className="rounded-2xl bg-slate-50 p-3" key={item}>
                          <span className="text-xs font-bold text-slate-500">{item}</span>
                          <strong className="mt-2 block text-2xl">{[91, 90, 98][index]}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/12 p-4">
                      <Clock3 className="text-cyan-300" />
                      <span className="text-sm text-slate-300">save time</span>
                    </div>
                    <div className="rounded-2xl bg-white/12 p-4">
                      <Globe2 className="text-blue-300" />
                      <span className="text-sm text-slate-300">active 24/7</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white py-6">
          <div className="section-shell flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-slate-500">
            {trustLogos.map((logo) => (
              <span className="rounded-full bg-slate-50 px-5 py-3" key={logo}>
                {logo}
              </span>
            ))}
          </div>
        </section>

        <MotionSection className="section-shell py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Services</span>
            <h2 className="mt-3 font-heading text-4xl font-bold text-slate-950 md:text-5xl">
              Delegate the work that keeps your business stuck in busy mode.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.slice(0, 8).map((service) => {
              const Icon = service.icon;
              return (
                <Card className="group transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-soft" key={service.title}>
                  <Icon className="text-blue-600" size={26} />
                  <h3 className="mt-5 font-heading text-lg font-bold text-slate-950">{service.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p>
                </Card>
              );
            })}
          </div>
        </MotionSection>

        <section className="bg-white py-20">
          <div className="section-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Why choose us</span>
              <h2 className="mt-3 font-heading text-4xl font-bold text-slate-950">
                AI is moving fast, but people still matter.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                Artificial intelligence is advancing rapidly, yet many prefer the human touch. We bridge that gap by assigning tasks and services to real, qualified people. Operating during UK/EU hours, we deliver the support your business needs with the personal interaction you value.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {qualitySignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div className="glass-panel rounded-3xl p-5" key={signal.label}>
                    <Icon className="text-cyan-600" />
                    <strong className="mt-4 block font-heading text-lg text-slate-950">{signal.label}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <MotionSection className="section-shell py-20">
          <div className="grid gap-6 md:grid-cols-4">
            {stats.map((stat) => (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm" key={stat.label}>
                <strong className="font-heading text-4xl font-extrabold text-slate-950">{stat.value}</strong>
                <span className="mt-3 block text-sm font-semibold text-slate-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </MotionSection>

        <section className="bg-slate-950 py-20 text-white">
          <div className="section-shell">
            <div className="max-w-3xl">
              <span className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">How it works</span>
              <h2 className="mt-3 font-heading text-4xl font-bold">From intake to execution in three clear steps.</h2>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {processSteps.map((step, index) => (
                <div className="rounded-3xl border border-white/10 bg-white/10 p-6" key={step.title}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500 font-heading text-lg font-bold">
                    {index + 1}
                  </span>
                  <h3 className="mt-6 font-heading text-xl font-bold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MotionSection className="section-shell py-20">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <span className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Featured assistants</span>
              <h2 className="mt-3 font-heading text-4xl font-bold text-slate-950">Specialized VA profiles for the work you need done.</h2>
            </div>
            <Button asChild variant="secondary">
              <Link href="/services">View all services</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {assistantProfiles.map((profile) => {
              const Icon = profile.icon;
              return (
                <Card key={profile.name}>
                  <Icon className="text-blue-600" size={28} />
                  <h3 className="mt-5 font-heading text-xl font-bold text-slate-950">{profile.name}</h3>
                  <p className="mt-3 text-slate-600">{profile.focus}</p>
                </Card>
              );
            })}
          </div>
        </MotionSection>

        <section className="bg-white py-20">
          <div className="section-shell">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Pricing</span>
              <h2 className="mt-3 font-heading text-4xl font-bold text-slate-950">Transparent hourly pricing for virtual assistance.</h2>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <Card className={plan.popular ? "border-blue-400 shadow-soft" : ""} key={plan.name}>
                  {plan.popular && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"></span>
                  )}
                  <h3 className="mt-4 font-heading text-2xl font-bold text-slate-950">{plan.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.summary}</p>
                  <div className="mt-6">
                    <strong className="font-heading text-4xl font-extrabold text-slate-950">{plan.price}</strong>
                    <span className="font-semibold text-slate-500">{plan.cadence}</span>
                  </div>
                  <ul className="mt-6 grid gap-3 text-sm font-semibold text-slate-700">
                    {plan.features.map((feature) => (
                      <li className="flex gap-2" key={feature}>
                        <ShieldCheck className="mt-0.5 shrink-0 text-cyan-600" size={16} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <MotionSection className="section-shell py-20">
          <div className="grid gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name}>
                <p className="text-lg leading-8 text-slate-700">“{testimonial.quote}”</p>
                <div className="mt-6">
                  <strong className="block text-slate-950">{testimonial.name}</strong>
                  <span className="text-sm font-semibold text-slate-500">{testimonial.role}</span>
                </div>
              </Card>
            ))}
          </div>
        </MotionSection>

        <section className="bg-white py-20">
          <div className="section-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600">FAQ</span>
              <h2 className="mt-3 font-heading text-4xl font-bold text-slate-950">Questions before you delegate?</h2>
            </div>
            <FAQAccordion />
          </div>
        </section>

        <section className="section-shell py-20">
          <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-soft md:p-12">
            <div className="max-w-3xl">
              <h2 className="font-heading text-4xl font-bold">Ready to build a calmer, faster business operation?</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Start with a free consultation and see how our virtual assistant service can streamline your operations.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/hire">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <FloatingChat />
      <SiteFooter />
      
    </>
  );
}
