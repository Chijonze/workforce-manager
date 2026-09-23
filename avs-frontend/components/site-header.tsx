"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { navigation, site } from "@/lib/site-content";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="section-shell flex min-h-16 items-center justify-between gap-6">
          <Link href="/" className="flex min-w-0 items-center" aria-label={`${site.name} home`}>
            <Image
              src={site.wordmarkLogo}
              alt={site.name}
              width={1890}
              height={710}
              className="h-auto w-[150px] sm:w-[180px] lg:w-[200px]"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link
                className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-navy"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-cta transition duration-200 hover:bg-brand-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
              href={site.whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              Book Free Consultation
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>

          <button
            className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-navy lg:hidden"
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white lg:hidden">
            <nav className="section-shell grid gap-2 py-4" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="section-shell grid gap-3 pb-4">
              <a
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-5 text-sm font-semibold text-white shadow-cta"
                href={site.whatsapp}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
              >
                Book Free Consultation
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
