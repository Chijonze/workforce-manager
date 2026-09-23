import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#071739",
        "navy-soft": "#0E2557",
        ink: "#111827",
        cloud: "#F8FAFC",
        brand: {
          blue: "#3A6CF4",
          "blue-dark": "#2B54C8",
          green: "#10B981",
          "green-dark": "#0B8F66",
        },
      },
      fontFamily: {
        heading: ["Poppins", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 24px 80px rgba(7, 23, 57, 0.12)",
        card: "0 10px 40px rgba(7, 23, 57, 0.08)",
        cta: "0 18px 40px rgba(58, 108, 244, 0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
