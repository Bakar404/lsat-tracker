import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // IMPORTANT: for GitHub Pages project sites use "/<repo-name>/"
  // Your site will be at: https://Bakar404.github.io/lsat-tracker/
  base: "/lsat-tracker/",
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
