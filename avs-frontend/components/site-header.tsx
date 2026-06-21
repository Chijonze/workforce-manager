"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ChatButton } from "@/components/chat-button";
import { navigation, site } from "@/lib/site-content";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="section-shell flex min-h-12 items-center justify-between gap-6 lg:min-h-18">
        <Link href="/" className="flex min-w-0 items-center" aria-label={`${site.name} home`}>
          <Image
            src={site.wordmarkLogo}
            alt={site.name}
            width={1890}
            height={710}
            className="h-auto w-[150px] sm:w-[180px] lg:w-[210px]"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              className="rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ChatButton size="sm">Get Started</ChatButton>
        </div>

        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-900 lg:hidden"
          type="button"
          aria-label="Open navigation"
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
          <div className="section-shell pb-4">
            <ChatButton className="w-full" onClick={() => setOpen(false)}>
              Get Started
            </ChatButton>
          </div>
        </div>
      )}
    </header>
  );
}
