import { Metadata } from "next";
import { IntakeForm } from "@/components/intake-form";
import { PageFrame } from "@/components/page-frame";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Begin working with our virtual assistant service by telling us about your business needs and operations.",
};

export default function HirePage() {
  return (
    <PageFrame
      eyebrow="Get Started"
      title="Tell us about your business needs and we'll set you up for success."
      summary="Share your operations, preferred tools, priorities, and timeline so we can provide the right support for your workflow."
    >
      <section className="section-shell py-20">
        <IntakeForm />
      </section>
    </PageFrame>
  );
}
