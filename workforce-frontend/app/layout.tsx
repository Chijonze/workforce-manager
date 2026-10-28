import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRuntime from "@/components/pwa/PwaRuntime";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://wfm.advancedvirtualsolutions.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ShiftSync — Workforce Management",
    template: "%s · ShiftSync",
  },
  description:
    "ShiftSync workforce management for administrators, hiring managers and agents: attendance, scheduling, live monitoring, leave and AI performance summaries.",
  applicationName: "ShiftSync",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: {
    capable: true,
    title: "ShiftSync",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/icons/favicon-48.png"],
  },
  other: {
    // iOS Safari still reads this legacy flag in addition to the manifest.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#101820" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <PwaRuntime />
      </body>
    </html>
  );
}
