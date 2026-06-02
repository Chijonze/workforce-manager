import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FAQAccordion } from "@/components/faq-accordion";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pricingPlans } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent hourly pricing for professional virtual assistant services. £4.50/hr with core administrative support included.",
};

export default function PricingPage() {
  return (
    <PageFrame
      eyebrow="Pricing"
      title="Simple, transparent hourly pricing for virtual assistant services."
      summary="Get professional administrative support with no hidden fees. Pay for the hours you need with flexible billing."
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
            <Button asChild className="mt-7 w-full">
              <Link href="/hire">Get Started</Link>
            </Button>
          </Card>
        ))}
      </section>
      <section className="bg-white py-20">
        <div className="section-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="font-heading text-4xl font-bold text-slate-950">Pricing questions</h2>
          <FAQAccordion />
        </div>
      </section>
    </PageFrame>
  );
}
