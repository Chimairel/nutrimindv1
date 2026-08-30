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
          accent: "var(--brand-accent)",
          cyan: "var(--brand-cyan)",
          violet: "var(--brand-violet)",
          black: "var(--brand-black)",
          dark: "var(--brand-dark)",
        },
        sidebar: {
          bg: "var(--sidebar-bg)",
          text: "var(--sidebar-text)",
          active: "var(--sidebar-active)",
          hover: "var(--sidebar-hover)",
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
        display: ["var(--font-outfit)", "var(--font-plus-jakarta-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        "xl": "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "card": "0 1px 2px rgba(5, 18, 14, 0.05), 0 12px 32px rgba(5, 18, 14, 0.07)",
        "card-hover": "0 18px 50px rgba(5, 18, 14, 0.12)",
        "card-lg": "0 28px 80px rgba(5, 18, 14, 0.18)",
        "neon": "0 0 0 1px rgba(184, 244, 95, 0.18), 0 0 36px rgba(184, 244, 95, 0.12)",
        "cyan": "0 0 32px rgba(97, 230, 255, 0.14)",
      },
    },
  },
  plugins: [],
};
export default config;
