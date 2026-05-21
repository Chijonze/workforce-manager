import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { FloatingChat } from "@/components/floating-chat";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

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
              <Button asChild>
                <Link href="/hire">
                  Hire a VA
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/contact">Book consultation</Link>
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
