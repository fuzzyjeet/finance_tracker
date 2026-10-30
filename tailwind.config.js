/** @type {import('tailwindcss').Config} */
// Colours point at the CSS variables in src/index.css (the Mocha theme), so the
// palette lives in one place. "rgb(var(--x-rgb) / <alpha-value>)" keeps
// opacity modifiers like bg-primary/10 working.
const withAlpha = (rgbVar) => `rgb(var(${rgbVar}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        "background": "var(--bg)",
        "surface": "var(--bg)",
        "surface-dim": "var(--bg)",
        "surface-bright": "var(--surface-highest)",
        "surface-variant": "var(--surface-highest)",
        "surface-container-lowest": "var(--bg)",
        "surface-container-low": "var(--surface-low)",
        "surface-container": "var(--surface)",
        "surface-container-high": "var(--surface-hi)",
        "surface-container-highest": "var(--surface-highest)",

        // Text
        "on-surface": "var(--text)",
        "on-background": "var(--text)",
        "on-surface-variant": "var(--text-2)",
        "muted": "var(--muted)",
        "faint": "var(--faint)",
        "outline": "var(--faint)",
        "outline-variant": "var(--faint-2)",

        // Accent (amber)
        "primary": withAlpha("--accent-rgb"),
        "primary-container": withAlpha("--accent-rgb"),
        "primary-fixed": withAlpha("--accent-rgb"),
        "primary-fixed-dim": withAlpha("--accent-rgb"),
        "surface-tint": withAlpha("--accent-rgb"),
        "on-primary": "var(--on-accent)",
        "on-primary-container": "var(--on-accent)",

        // Meaning
        "secondary": withAlpha("--income-rgb"),
        "secondary-container": withAlpha("--income-rgb"),
        "secondary-fixed": withAlpha("--income-rgb"),
        "secondary-fixed-dim": withAlpha("--income-rgb"),
        "on-secondary": "var(--on-accent)",
        "income": withAlpha("--income-rgb"),
        "expense": withAlpha("--expense-rgb"),
        "error": withAlpha("--expense-rgb"),
        "error-container": withAlpha("--expense-rgb"),
        "on-error": "var(--on-accent)",
        "on-error-container": "var(--text)",
        "transfer": withAlpha("--transfer-rgb"),
        "refund": withAlpha("--refund-rgb"),
        "tertiary": withAlpha("--refund-rgb"),
        "warn": withAlpha("--warn-rgb"),
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.25rem",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        headline: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        body: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        label: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
