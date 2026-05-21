import { Metadata } from "next";
import { IntakeForm } from "@/components/intake-form";
import { PageFrame } from "@/components/page-frame";

export const metadata: Metadata = {
  title: "Hire a VA",
  description: "Complete a guided intake form to get matched with a trained virtual assistant for your business needs.",
};

export default function HirePage() {
  return (
    <PageFrame
      eyebrow="Hire a VA"
      title="Tell us what you need and we will help match you with the right assistant."
      summary="Use the intake flow to share your business needs, preferred skills, budget, and timeline for onboarding."
    >
      <section className="section-shell py-20">
        <IntakeForm />
      </section>
    </PageFrame>
  );
}
