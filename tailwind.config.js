/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        raised: v("raised"),
        line: v("line"),
        fg: v("fg"),
        dim: v("dim"),
        accent: v("accent"),
        side: v("side"),
        "side-line": v("side-line"),
        "nav-on": v("nav-on"),
        "accent-fg": v("accent-fg"),
        good: v("good"),
        bad: v("bad"),
        warn: v("warn"),
        brand: v("accent"), // legacy alias
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)",
        pop: "0 8px 24px -6px rgb(15 20 40 / 0.14), 0 2px 6px rgb(15 20 40 / 0.06)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.35), 0 8px 24px -8px rgb(var(--accent) / 0.45)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
      },
      animation: {
        shimmer: "shimmer 1.4s infinite",
        "fade-in": "fade-in .25s ease-out both",
        pulse2: "pulse2 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
