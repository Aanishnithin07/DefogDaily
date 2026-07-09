/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0B0E14",
          elevated: "#121827",
          card: "#182033",
        },
        accent: {
          cyan: "#3ED9D5",
          violet: "#8A7BFF",
        },
        success: "#32D583",
        danger: "#F97066",
        text: {
          primary: "#F5F8FF",
          secondary: "#9AA7C2",
        },
      },
      borderRadius: {
        "2xl-soft": "1.1rem",
        "3xl-soft": "1.6rem",
      },
      boxShadow: {
        "glow-cyan": "0 0 36px rgba(62, 217, 213, 0.34)",
        "glow-violet": "0 0 40px rgba(138, 123, 255, 0.32)",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
