/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          border: "var(--sidebar-border)",
          text: "var(--sidebar-text)",
          muted: "var(--sidebar-text-muted)",
        },
        status: {
          good: "var(--status-good)",
          "good-bg": "var(--status-good-bg)",
          warning: "var(--status-warning)",
          "warning-bg": "var(--status-warning-bg)",
          critical: "var(--status-critical)",
          "critical-bg": "var(--status-critical-bg)",
          info: "var(--status-info)",
          "info-bg": "var(--status-info-bg)",
        },
        cat: {
          1: "var(--cat-1)",
          2: "var(--cat-2)",
          3: "var(--cat-3)",
          4: "var(--cat-4)",
          5: "var(--cat-5)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20, 19, 15, 0.04), 0 1px 0 rgba(20, 19, 15, 0.03)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.55 },
        },
        "fade-in": {
          from: { opacity: 0, transform: "translateY(4px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: 0, transform: "scale(0.98)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s ease-in-out infinite",
        "fade-in": "fade-in 0.25s ease-out",
        "fade-in-scale": "fade-in-scale 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
