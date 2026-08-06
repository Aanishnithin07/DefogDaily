/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          void: "#05070C",
          base: "#0B0E14",
          elevated: "#121827",
          card: "#182033",
          raised: "#1E273D",
        },
        accent: {
          cyan: "#3ED9D5",
          "cyan-dim": "#1E9B98",
          violet: "#8A7BFF",
          "violet-dim": "#5B4FCC",
          amber: "#FFB454",
          emerald: "#3DDC97",
          rose: "#FF6B8A",
        },
        success: "#32D583",
        danger: "#F97066",
        warning: "#FDB022",
        text: {
          primary: "#F5F8FF",
          secondary: "#9AA7C2",
          tertiary: "#64708C",
        },
        hairline: "rgba(245, 248, 255, 0.08)",
      },
      borderRadius: {
        "xl-soft": "0.85rem",
        "2xl-soft": "1.1rem",
        "3xl-soft": "1.6rem",
        "4xl-soft": "2.2rem",
      },
      boxShadow: {
        "glow-cyan": "0 0 36px rgba(62, 217, 213, 0.34)",
        "glow-violet": "0 0 40px rgba(138, 123, 255, 0.32)",
        "glow-amber": "0 0 36px rgba(255, 180, 84, 0.30)",
        "glow-emerald": "0 0 36px rgba(61, 220, 151, 0.30)",
        "glow-rose": "0 0 36px rgba(255, 107, 138, 0.30)",
        // Layered depth: crisp inner highlight over a soft ambient drop.
        lift: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 18px 48px -24px rgba(0,0,0,0.9)",
        "lift-lg": "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 32px 80px -32px rgba(0,0,0,0.95)",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.06em" }],
      },
      letterSpacing: {
        widest2: "0.22em",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(245,248,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,248,255,0.045) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "44px 44px",
      },
      keyframes: {
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(3%, -4%, 0) scale(1.06)" },
          "66%": { transform: "translate3d(-3%, 3%, 0) scale(0.97)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sheen-sweep": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "aurora-drift": "aurora-drift 22s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        "slide-up-fade": "slide-up-fade 0.32s cubic-bezier(0.22,1,0.36,1) both",
        "sheen-sweep": "sheen-sweep 4s linear infinite",
      },
      transitionTimingFunction: {
        defog: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
