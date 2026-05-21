import { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Advanced Virtual Solutions to book a consultation, ask about VA services, or start your support plan.",
};

export default function ContactPage() {
  return (
    <PageFrame
      eyebrow="Contact"
      title="Let’s talk about the support your business needs next."
      summary="Send a message, book a discovery call, or reach us on WhatsApp for a faster conversation."
    >
      <section className="section-shell grid gap-8 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="font-heading text-2xl font-bold text-slate-950">Send a message</h2>
          <form className="mt-6 grid gap-4 sm:grid-cols-2">
            <input placeholder="Full name" />
            <input placeholder="Work email" type="email" />
            <input placeholder="Company" />
            <input placeholder="Service interest" />
            <textarea className="sm:col-span-2" placeholder="Tell us what you need help with" rows={5} />
            <Button className="sm:col-span-2" type="button">Submit inquiry</Button>
          </form>
        </Card>
        <div className="grid gap-4">
          <Card>
            <Mail className="text-blue-600" />
            <h2 className="mt-4 font-heading text-xl font-bold text-slate-950">Email</h2>
            <a className="mt-2 block font-semibold text-slate-600" href={`mailto:${site.email}`}>
              {site.email}
            </a>
          </Card>
          <Card>
            <MessageCircle className="text-cyan-600" />
            <h2 className="mt-4 font-heading text-xl font-bold text-slate-950">WhatsApp</h2>
            <Button asChild className="mt-4">
              <a href={site.whatsapp}>Start WhatsApp chat</a>
            </Button>
          </Card>
        </div>
      </section>
    </PageFrame>
  );
}
