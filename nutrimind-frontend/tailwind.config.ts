import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          bg: "var(--brand-bg)",
          bgAlt: "var(--brand-bg-alt)",
          surface: "var(--brand-surface)",
          border: "var(--brand-border)",
          green: "var(--brand-green)",
          greenHover: "var(--brand-green-hover)",
          greenLight: "var(--brand-green-light)",
          text: "var(--brand-text)",
          muted: "var(--brand-muted)",
        },
        status: {
          verified: {
            bg: "#D1FAE5",
            text: "#065F46",
          },
          pending: {
            bg: "#FEF3C7",
            text: "#92400E",
          },
          rejected: {
            bg: "#FEE2E2",
            text: "#991B1B",
          },
          error: {
            bg: "#FEE2E2",
            text: "#991B1B",
          },
          ai: {
            bg: "#EDE9FE",
            text: "#5B21B6",
          },
          user: {
            bg: "#DBEAFE",
            text: "#1E40AF",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        display: ["var(--font-plus-jakarta-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
