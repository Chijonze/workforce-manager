import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: {
    default: "Advanced Virtual Solutions | Elite Virtual Assistant Agency",
    template: "%s | Advanced Virtual Solutions",
  },
  description:
    "Hire reliable, professional, technology-driven virtual assistants for admin, executive support, customer service, social media, CRM, and business operations.",
  keywords: [
    "virtual assistant agency",
    "hire virtual assistants",
    "remote executive assistants",
    "business support services",
    "virtual assistant for entrepreneurs",
    "social media virtual assistant",
    "affordable virtual assistants",
  ],
  openGraph: {
    title: "Advanced Virtual Solutions",
    description: "Scale faster with reliable, professional, technology-driven virtual assistance.",
    url: site.domain,
    siteName: site.name,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
