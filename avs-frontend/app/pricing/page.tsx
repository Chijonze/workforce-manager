import { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { CallButton } from "@/components/call-button";
import { ChatButton } from "@/components/chat-button";
import { FAQAccordion } from "@/components/faq-accordion";
import { PageFrame } from "@/components/page-frame";
import { Card } from "@/components/ui/card";
import { faqs, planInclusions, pricingPlans } from "@/lib/site-content";

const pricingQuestions = [
  "How quickly can we start?",
  "How do I know the hours I'm billed for were actually worked?",
  "How does billing and invoicing work?",
  "Can plans scale up or down?",
  "Do I get a dedicated assistant?",
  "How is our data protected?",
];

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent hourly pricing for managed virtual assistant services. £4.50/hr with scheduling, verified timesheets, reporting and invoicing included.",
};

export default function PricingPage() {
  return (
    <PageFrame
      eyebrow="Pricing"
      title="Simple, transparent hourly pricing for virtual assistant services."
      summary="Pay for the hours recorded on shift — no hidden fees, no minimum package. Every plan includes scheduling, verified timesheets, shift reporting and an itemised invoice."
    >
      <section className="section-shell grid gap-5 py-20 lg:grid-cols-3">
        {pricingPlans.map((plan) => (
          <Card className={plan.popular ? "border-blue-400 shadow-soft" : ""} key={plan.name}>
            <h2 className="font-heading text-2xl font-bold text-slate-950">{plan.name}</h2>
            <p className="mt-3 min-h-14 text-sm leading-6 text-slate-600">{plan.summary}</p>
            <div className="mt-6">
              <strong className="font-heading text-5xl font-extrabold text-slate-950">{plan.price}</strong>
              <span className="font-semibold text-slate-500">{plan.cadence}</span>
            </div>
            <ul className="mt-7 grid gap-3 text-sm font-semibold text-slate-700">
              {plan.features.map((feature) => (
                <li className="flex gap-2" key={feature}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-600" size={17} />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-7 grid gap-3">
              <ChatButton className="w-full">Get Started</ChatButton>
              <CallButton className="w-full" variant="secondary">Call us now</CallButton>
            </div>
          </Card>
        ))}
      </section>
      <section className="section-shell pb-20">
        <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-card lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Included in the rate</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-navy">No hidden extras. No surprise line items.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The hourly rate covers the delivery system around your assistant — not just their time.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {planInclusions.map((item) => (
              <li className="flex gap-2 text-sm font-semibold text-slate-700" key={item}>
                <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-600" size={17} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="bg-white py-20">
        <div className="section-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="font-heading text-4xl font-bold text-slate-950">Pricing questions</h2>
          <FAQAccordion items={faqs.filter((faq) => pricingQuestions.includes(faq.question))} />
        </div>
      </section>
    </PageFrame>
  );
}
