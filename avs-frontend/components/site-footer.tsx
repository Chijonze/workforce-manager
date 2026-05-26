import Link from "next/link";
import { Mail, MessageCircle, Phone, MapPin } from "lucide-react";
import { navigation, site } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="section-shell grid gap-10 py-12 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-950">{site.name}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Professional virtual assistance for founders, executives, agencies, coaches, eCommerce
            brands, and growing teams that need reliable operational leverage.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
            <a className="inline-flex items-center gap-2" href={`mailto:${site.email}`}>
              <Mail size={16} />
              {site.email}
            </a>
            <a className="inline-flex items-center gap-2" href={`tel:${site.phone}`}>
              <Phone size={16} />
              {site.phone}
            </a>
            <a className="inline-flex items-center gap-2" href={site.whatsapp}>
              <MessageCircle size={16} />
              WhatsApp
            </a>
          </div>
          <div className="mt-3 inline-flex items-start gap-2 text-sm text-slate-700">
            <MapPin size={16} className="mt-0.5 flex-shrink-0" />
            <span>{site.address}</span>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-4">
          {navigation.map((item) => (
            <Link className="hover:text-blue-600" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-slate-200 py-5 text-center text-xs font-semibold text-slate-500">
        © {new Date().getFullYear()} Advanced Virtual Solutions. All rights reserved.
      </div>
    </footer>
  );
}
