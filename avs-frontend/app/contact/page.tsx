import { Metadata } from "next";
import { Mail, MessageCircle, PhoneCall } from "lucide-react";

import { CallButton } from "@/components/call-button";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatButton } from "@/components/chat-button";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Advanced Virtual Solutions to chat with our team or reach out via email.",
};

export default function ContactPage() {
  return (
    <PageFrame
      eyebrow="Contact"
      title="Connect with us directly."
      summary="Chat instantly with our team or send us an email. We're here to help."
    >
      <section className="section-shell grid gap-8 py-20 lg:grid-cols-3">
        <Card>
          <PhoneCall className="text-blue-600" size={32} />
          <h2 className="mt-4 font-heading text-2xl font-bold text-navy">Phone</h2>
          <p className="mt-2 text-slate-600">Speak with our team directly about your VA needs, onboarding, or pricing questions.</p>
          <CallButton className="mt-6">
            {site.phoneDisplay}
          </CallButton>
        </Card>
        <Card>
          <MessageCircle className="text-blue-600" size={32} />
          <h2 className="mt-4 font-heading text-2xl font-bold text-navy">Live Chat</h2>
          <p className="mt-2 text-slate-600">Chat with our team instantly using the live chat widget available on this site. Click the chat button at the bottom right to get started.</p>
          <ChatButton className="mt-6">
            Open Chat
          </ChatButton>
        </Card>
        <Card>
          <Mail className="text-blue-600" size={32} />
          <h2 className="mt-4 font-heading text-2xl font-bold text-navy">Email</h2>
          <p className="mt-2 text-slate-600">Prefer email? Send us a message directly at the address below.</p>
          <a
            href={`mailto:${site.email}`}
            className="mt-6 inline-flex items-center rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition hover:bg-brand-blue-dark"
          >
            {site.email}
          </a>
        </Card>
      </section>

      <section className="section-shell pb-20">
        <div className="flex flex-col items-center gap-6 rounded-[2rem] bg-navy p-8 text-white shadow-soft md:flex-row md:justify-between md:p-12 md:text-left">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-green/20 text-brand-green">
              <MessageCircle size={28} />
            </span>
            <div>
              <h2 className="font-heading text-2xl font-bold md:text-3xl">Chat Us on WhatsApp</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
                The fastest way to reach us. Ask about services, pricing, or onboarding and get a
                reply during {site.hours} — no forms, no waiting.
              </p>
            </div>
          </div>
          <Button asChild size="lg" variant="green" className="w-full shrink-0 sm:w-auto">
            <a href={site.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              Chat Us on WhatsApp
            </a>
          </Button>
        </div>
      </section>
    </PageFrame>
  );
}
