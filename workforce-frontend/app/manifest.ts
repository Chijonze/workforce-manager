import type { MetadataRoute } from "next";

// The manifest is served by Next at /manifest.webmanifest. Keep the start URL,
// scope and icons same-origin: the app is installed from the WFM domain, while
// the API and monitoring socket stay on their existing subdomains.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ShiftSync — Workforce Management",
    short_name: "ShiftSync",
    description:
      "ShiftSync workforce management for administrators, hiring managers and agents: attendance, scheduling, live monitoring, leave and AI performance summaries.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#f4f7f8",
    theme_color: "#0f766e",
    lang: "en-GB",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open the role-aware ShiftSync dashboard",
        url: "/?section=overview",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Team chat",
        short_name: "Chat",
        description: "Open authorised team conversations",
        url: "/?section=chat",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
