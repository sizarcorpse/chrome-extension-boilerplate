import type { Config } from "tailwindcss";

const config = {
  content: ["./**/*.html", "./**/*.ts"],
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
} satisfies Config;

export default config;
