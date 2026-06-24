"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { CallButton } from "@/components/call-button";
import { ChatButton } from "@/components/chat-button";
import { FloatingChat } from "@/components/floating-chat";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site-content";

export function PageFrame({
  children,
  eyebrow,
  title,
  summary,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  summary: string;
}) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="bg-slate-950 py-20 text-white">
          <div className="section-shell max-w-4xl">
            <span className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</span>
            <h1 className="mt-4 font-heading text-5xl font-extrabold tracking-tight text-balance md:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ChatButton>Get Started</ChatButton>
              <CallButton variant="secondary">Call us now</CallButton>
              <Button
                asChild
                className="bg-emerald-600 text-white shadow-[0_18px_40px_rgba(5,150,105,0.28)] hover:bg-emerald-500 focus-visible:outline-emerald-500"
                variant="secondary"
              >
                <Link href={site.whatsapp}>
                  <MessageCircle size={17} />
                  Chat us on WhatsApp
                </Link>
              </Button>
            </div>
          </div>
        </section>
        {children}
      </main>
      <FloatingChat />
      <SiteFooter />
    </>
  );
}
