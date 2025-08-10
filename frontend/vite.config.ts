import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/lsat-tracker/", // <-- repo name (Bakar404/lsat-tracker)
  plugins: [react()],
  build: { outDir: "dist" }
});
