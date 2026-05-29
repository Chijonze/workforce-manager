import type { Metadata } from "next";
import Script from "next/script";
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
      <body>
        {children}
        <Script
          id="chatwoot-sdk"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(d,t) {
                var BASE_URL="https://chat.advancedvirtualsolutions.com";
                var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
                g.src=BASE_URL+"/packs/js/sdk.js";
                g.async = true;
                s.parentNode.insertBefore(g,s);
                g.onload=function(){
                  window.chatwootSDK.run({
                    websiteToken: 'a46yakbsZ16SMcV9BtH39Srr',
                    baseUrl: BASE_URL
                  })
                }
              })(document,"script");
            `,
          }}
        />
      </body>
    </html>
  );
}
