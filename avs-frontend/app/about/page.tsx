import { Metadata } from "next";
import { PageFrame } from "@/components/page-frame";
import { Card } from "@/components/ui/card";
import { processSteps, values } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "About",
  description: "Learn how Advanced Virtual Solutions supports businesses with reliable virtual assistants and structured remote operations.",
};

export default function AboutPage() {
  return (
    <PageFrame
      eyebrow="About us"
      title="A virtual assistant agency built for organized, modern growth."
      summary="Advanced Virtual Solutions helps leaders reclaim time, improve responsiveness, and build dependable remote operating systems."
    >
      <section className="section-shell grid gap-10 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-heading text-4xl font-bold text-slate-950">Our story</h2>
          <p className="mt-5 text-base leading-8 text-slate-600">
            We exist for businesses that have outgrown doing everything manually but still value the power of genuine human connection.
             We believe growth shouldn't mean losing your personal touch to cold automation. That is why our model blends deeply empathetic,
              trained virtual assistants with clear process design and managed execution.
             By putting people at the heart of our operations, we ensure your daily support feels calm, professional, and deeply human.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map((value) => (
            <Card key={value.title}>
              <h3 className="font-heading text-xl font-bold text-slate-950">{value.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{value.description}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="bg-white py-20">
        <div className="section-shell">
          <h2 className="font-heading text-4xl font-bold text-slate-950">Our process</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {processSteps.map((step, index) => (
              <Card key={step.title}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-5 font-heading text-xl font-bold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
