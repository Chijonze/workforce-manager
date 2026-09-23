import Image from "next/image";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { footerColumns, site } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="section-shell grid gap-12 py-16 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="inline-flex rounded-2xl bg-white p-3">
            <Image
              src={site.wordmarkLogo}
              alt={site.name}
              width={1890}
              height={710}
              className="h-auto w-[220px] sm:w-[260px]"
            />
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
            {site.tagline} Operating during {site.hours} with flexible hourly support from £4.50/hr.
          </p>
          <div className="mt-6 grid gap-3 text-sm font-semibold">
            <a className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white" href={`mailto:${site.email}`}>
              <Mail size={16} className="text-brand-green" />
              {site.email}
            </a>
            <a className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white" href={site.phoneHref}>
              <Phone size={16} className="text-brand-green" />
              {site.phoneDisplay}
            </a>
            <a className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white" href={site.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={16} className="text-brand-green" />
              Chat on WhatsApp
            </a>
          </div>
        </div>

        <nav
          className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Footer navigation"
        >
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-green">
                {column.title}
              </h3>
              <ul className="mt-4 grid gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="text-slate-300 transition hover:text-white" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h3 className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand-green">Contact</h3>
            <ul className="mt-4 grid gap-2.5 text-slate-300">
              <li>{site.phoneDisplay}</li>
              <li className="break-all">{site.email}</li>
              <li>{site.hours}</li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="section-shell flex flex-col items-center justify-between gap-3 py-5 text-xs font-semibold text-slate-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Advanced Virtual Solutions. All rights reserved.</span>
          <span>Dedicated virtual assistants · Flexible hourly support</span>
        </div>
      </div>
    </footer>
  );
}
