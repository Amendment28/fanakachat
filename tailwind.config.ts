import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2D6A4F",
        secondary: "#F4A300",
        accent: "#FF6B35",
        charcoal: "#2B2D42",
        background: "#FFFFFF",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;