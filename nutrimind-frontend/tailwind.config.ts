import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
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
            bg: "var(--status-verified-bg)",
            text: "var(--status-verified-text)",
          },
          pending: {
            bg: "var(--status-pending-bg)",
            text: "var(--status-pending-text)",
          },
          rejected: {
            bg: "var(--status-rejected-bg)",
            text: "var(--status-rejected-text)",
          },
          error: {
            bg: "var(--status-error-bg)",
            text: "var(--status-error-text)",
          },
          ai: {
            bg: "var(--status-ai-bg)",
            text: "var(--status-ai-text)",
          },
          user: {
            bg: "var(--status-user-bg)",
            text: "var(--status-user-text)",
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
