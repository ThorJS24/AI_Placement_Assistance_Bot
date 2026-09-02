// Reads the "brand" palette from CSS custom properties (defined in
// index.css, swapped per data-theme attribute on <html>) instead of
// hard-coded hex values, so every existing bg-brand-*/text-brand-*/
// border-brand-* class across the app responds live to the student's chosen
// color theme - no per-file changes and no rebuild needed to switch themes.
function withOpacity(varName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) return `rgb(var(${varName}) / ${opacityValue})`;
    return `rgb(var(${varName}))`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Default values live in index.css's :root block (CHRIST (Deemed to
        // be University)'s actual navy institutional colour, extracted from
        // their stylesheet: $themeColorBlue: #0b1f3a). Alternate presets
        // (Ocean/Forest/Crimson) override the same variables under
        // html[data-theme="..."] selectors - see index.css.
        brand: {
          50: withOpacity("--brand-50"),
          100: withOpacity("--brand-100"),
          200: withOpacity("--brand-200"),
          300: withOpacity("--brand-300"),
          400: withOpacity("--brand-400"),
          500: withOpacity("--brand-500"),
          600: withOpacity("--brand-600"),
          700: withOpacity("--brand-700"),
          800: withOpacity("--brand-800"),
          900: withOpacity("--brand-900"),
          950: withOpacity("--brand-950"),
        },
        // Kept constant across color themes (not swappable) - it's the
        // institution's secondary accent, and varying two independent hues
        // per theme roughly quadruples palette-authoring/contrast risk for
        // little visible benefit, since gold is only used as a sparing highlight.
        gold: {
          50: "#fdf6ea",
          100: "#faecd1",
          200: "#f3d9a6",
          300: "#eac378",
          400: "#DDAE68",
          500: "#D98600",
          600: "#b3862b",
          700: "#8f6a1f",
          800: "#6b4f17",
          900: "#4a3710",
          950: "#2c2009",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(31 78 121 / 0.12)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out both",
        "slide-up": "slideUp 0.35s ease-out both",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseSoft: { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.5 } },
      },
    },
  },
  plugins: [],
};
