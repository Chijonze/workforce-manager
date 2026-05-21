import { Metadata } from "next";
import { PageFrame } from "@/components/page-frame";
import { Card } from "@/components/ui/card";
import { services } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore virtual assistant services for admin, executive support, customer support, social media, CRM, lead generation, and operations.",
};

export default function ServicesPage() {
  return (
    <PageFrame
      eyebrow="Services"
      title="Flexible virtual assistant services for the work your team should not be stuck doing."
      summary="Choose focused support across operations, customer experience, growth, content, and management workflows."
    >
      <section className="section-shell grid gap-5 py-20 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Card key={service.title}>
              <Icon className="text-blue-600" size={28} />
              <h2 className="mt-5 font-heading text-xl font-bold text-slate-950">{service.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p>
            </Card>
          );
        })}
      </section>
    </PageFrame>
  );
}
