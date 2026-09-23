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
    "Dedicated virtual assistant services for founders, agencies, coaches, eCommerce brands, and growing teams. Executive virtual assistance, remote assistants, and virtual staffing from £4.50/hr with fast onboarding.",
  keywords: [
    "virtual assistant services",
    "executive virtual assistant",
    "remote assistant",
    "virtual staffing",
    "business support services",
    "administrative support",
    "lead generation support",
    "customer service support",
  ],
  openGraph: {
    title: "Advanced Virtual Solutions | Scale Without the Day-to-Day",
    description:
      "Dedicated virtual assistants helping founders and growing teams save 20+ hours a week. Book a free consultation.",
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
