import type { Config } from "tailwindcss";

const praiermeterPreset = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        pm: {
          purple: "#30003F",
          turquoise: "#12E2D2",
          orange: "#FF7A00",
          pink: "#FF087F",
          yellow: "#FFF000",
          lime: "#A8F200",
          cream: "#FFF9F4",
          canvas: "#F7F2F8",
          text: "#30003F",
          muted: "#655A6B",
          border: "#D7CDD9",
          fresh: "#17684F",
          "fresh-surface": "#ECFFF9",
          aging: "#725000",
          "aging-surface": "#FFF7D6",
          missing: "#8D1B42",
          "missing-surface": "#FFF0F7",
          focus: "#007A70"
        }
      },
      fontFamily: {
        display: ["Rubik", "SF Hebrew Rounded", "Arial Hebrew", "sans-serif"],
        sans: ["Heebo", "SF Hebrew", "Arial Hebrew", "Arial", "sans-serif"],
        numeric: ["Inter", "Arial", "sans-serif"]
      },
      fontSize: {
        "display-sm": ["2rem", { lineHeight: "1.15", fontWeight: "900" }],
        display: ["2.75rem", { lineHeight: "1.1", fontWeight: "900" }],
        title: ["1.5rem", { lineHeight: "1.25", fontWeight: "800" }],
        subtitle: ["1.125rem", { lineHeight: "1.4", fontWeight: "700" }],
        body: ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        label: ["0.875rem", { lineHeight: "1.35", fontWeight: "700" }],
        caption: ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }]
      },
      borderRadius: {
        "pm-sm": "0.5rem",
        pm: "0.875rem",
        "pm-lg": "1.125rem",
        "pm-xl": "1.375rem"
      },
      boxShadow: {
        "pm-card": "0 8px 24px rgb(48 0 63 / 10%)",
        "pm-float": "0 16px 40px rgb(48 0 63 / 16%)"
      },
      keyframes: {
        "pm-needle": {
          "0%, 100%": { transform: "rotate(-6deg)" },
          "50%": { transform: "rotate(6deg)" }
        }
      },
      animation: {
        "pm-needle": "pm-needle 900ms cubic-bezier(.2,.8,.2,1) both"
      }
    }
  }
} satisfies Config;

export default praiermeterPreset;
