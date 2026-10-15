import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:   "#1B2E6B",
          yellow: "#F5C518",
          bg:     "#EEF1F8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-ethiopic)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "var(--font-ethiopic)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
