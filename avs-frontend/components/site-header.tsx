"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigation, site } from "@/lib/site-content";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white">
      <div className="section-shell flex min-h-20 items-center justify-between gap-6">
        <Link href="/" className="flex min-w-0 items-center" aria-label={`${site.name} home`}>
          <Image
            src={site.logo}
            alt={site.name}
            width={559}
            height={144}
            className="h-12 w-auto sm:h-14"
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
          <Button asChild variant="secondary" size="sm">
            <Link href={site.voiceCall}>
              <PhoneCall size={16} />
              Call Now
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/contact">Book Consultation</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/hire">Get Started</Link>
          </Button>
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
            <Link
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              href={site.voiceCall}
              onClick={() => setOpen(false)}
            >
              Call Now
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
