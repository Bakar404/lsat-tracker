//ignore
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/lsat-tracker/", // repo name
  plugins: [react()],
  build: {
    outDir: "../docs", // write to <repo>/docs
    emptyOutDir: true,
  },
});
