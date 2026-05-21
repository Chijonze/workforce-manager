import { Metadata } from "next";
import { IntakeForm } from "@/components/intake-form";
import { PageFrame } from "@/components/page-frame";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Become a VA",
  description: "Apply to become a virtual assistant with Advanced Virtual Solutions and support businesses remotely.",
};

const benefits = ["Remote work opportunities", "Training process", "Professional client matching", "Growth-focused support"];

export default function CareersPage() {
  return (
    <PageFrame
      eyebrow="Careers"
      title="Join a remote assistant network built around professionalism and growth."
      summary="Apply if you are organized, communicative, tech-comfortable, and ready to support clients with excellence."
    >
      <section className="section-shell grid gap-8 py-20 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="grid gap-4">
          {benefits.map((benefit) => (
            <Card key={benefit}>
              <strong className="font-heading text-lg text-slate-950">{benefit}</strong>
            </Card>
          ))}
        </div>
        <IntakeForm mode="career" />
      </section>
    </PageFrame>
  );
}
