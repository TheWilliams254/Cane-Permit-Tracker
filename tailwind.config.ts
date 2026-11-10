import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cane: {
          50: "#F1F6F1",
          100: "#DDEADD",
          200: "#B9D4BA",
          300: "#8DB890",
          400: "#5E9763",
          500: "#3C7A43",
          600: "#2C6334",
          700: "#1F4D2B",
          800: "#163A21",
          900: "#0F2817",
        },
        sugar: {
          100: "#FBF1DC",
          300: "#F0CF8A",
          500: "#D08A1E",
          700: "#9A6412",
        },
        ink: "#15211A",
        stone: {
          50: "#F7F8F7",
          100: "#EEF1EE",
          200: "#DDE2DD",
          300: "#C3CBC4",
          500: "#6B7570",
          700: "#454D48",
        },
        danger: "#B3261E",
        info: "#1D5C8C",
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', '"Atkinson Hyperlegible"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(21,33,26,0.06), 0 0 0 1px rgba(21,33,26,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
