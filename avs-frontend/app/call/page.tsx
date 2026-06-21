import { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, MessageCircle, PhoneCall } from "lucide-react";
import { CallButton } from "@/components/call-button";
import { ChatButton } from "@/components/chat-button";
import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Call Us",
  description: "Call Advanced Virtual Solutions to discuss virtual assistant support, onboarding, pricing, and service fit.",
};

const callReasons = [
  "Discuss the support you need before you start",
  "Confirm pricing, availability, and onboarding timing",
  "Talk through urgent admin, customer support, or operations gaps",
  "Choose the best next step: phone, live chat, WhatsApp, or email",
];

export default function CallPage() {
  return (
    <PageFrame
      eyebrow="Call us"
      title="Speak with Advanced Virtual Solutions today."
      summary="Have a quick conversation with our team about your business needs, the work you want to delegate, and the fastest way to get matched with virtual assistant support."
    >
      <section className="section-shell grid gap-8 py-20 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-blue-200 shadow-soft">
          <PhoneCall className="text-blue-600" size={36} />
          <h2 className="mt-5 font-heading text-3xl font-bold text-slate-950">Call us now</h2>
          <p className="mt-3 text-slate-600">
            Reach the team directly at <strong className="text-slate-950">{site.phoneDisplay}</strong>.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <CallButton size="lg" className="w-full">
              Call now
            </CallButton>
            <Button asChild size="lg" variant="secondary">
              <Link href={site.whatsapp}>
                <MessageCircle size={18} />
                WhatsApp
              </Link>
            </Button>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CalendarCheck className="text-cyan-600" size={30} />
            <h2 className="mt-4 font-heading text-2xl font-bold text-slate-950">Best reasons to call</h2>
            <ul className="mt-5 grid gap-3 text-sm font-semibold text-slate-700">
              {callReasons.map((reason) => (
                <li className="flex gap-2" key={reason}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-600" size={17} />
                  {reason}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <MessageCircle className="text-blue-600" size={30} />
            <h2 className="mt-4 font-heading text-2xl font-bold text-slate-950">Prefer messaging?</h2>
            <p className="mt-2 text-slate-600">
              You can still start with live chat if that is easier. We will collect the essentials and help you move quickly.
            </p>
            <ChatButton className="mt-6">Open live chat</ChatButton>
          </Card>
        </div>
      </section>
    </PageFrame>
  );
}
