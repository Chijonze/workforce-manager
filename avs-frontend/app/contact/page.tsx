import { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";

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
      <section className="section-shell grid gap-8 py-20 lg:grid-cols-2">
        <Card>
          <MessageCircle className="text-blue-600" size={32} />
          <h2 className="mt-4 font-heading text-2xl font-bold text-slate-950">Live Chat</h2>
          <p className="mt-2 text-slate-600">Chat with our team instantly using the live chat widget available on this site. Click the chat button at the bottom right to get started.</p>
          <ChatButton className="mt-6">
            Open Chat
          </ChatButton>
        </Card>
        <Card>
          <Mail className="text-blue-600" size={32} />
          <h2 className="mt-4 font-heading text-2xl font-bold text-slate-950">Email</h2>
          <p className="mt-2 text-slate-600">Prefer email? Send us a message directly at the address below.</p>
          <a 
            href={`mailto:${site.email}`}
            className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-500"
          >
            {site.email}
          </a>
        </Card>
      </section>
    </PageFrame>
  );
}
