import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { site } from "@/lib/site-content";

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: {
    default: "Advanced Virtual Solutions | Virtual Assistant Services",
    template: "%s | Advanced Virtual Solutions",
  },
  description:
    "Virtual assistant services for admin support, executive assistance, customer service, social media, CRM, and business operations. £4.50/hr.",
  keywords: [
    "virtual assistant services",
    "remote executive assistance",
    "business support services",
    "administrative support",
    "social media management",
    "customer service support",
  ],
  openGraph: {
    title: "Advanced Virtual Solutions",
    description: "Scale faster with reliable, technology-driven virtual assistance.",
    url: site.domain,
    siteName: site.name,
    images: [site.logo],
    type: "website",
  },
  icons: {
    icon: site.logo,
    apple: site.logo,
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
