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
        background: "#0d0d0d",
        foreground: "#f3f4f6",
        brand: {
          bg: "#0d0d0d",
          bgAlt: "#141416",
          surface: "#1a1a1e",
          border: "#2a2a2e",
          green: "#52B788",
          greenLight: "#4caf50",
          text: "#f3f4f6",
          muted: "#6B7280",
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
