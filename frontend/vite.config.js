import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The FastAPI backend serves /api; in development Vite proxies to it.
const apiPort = process.env.API_PORT || "8613";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5183,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
  preview: {
    port: 4183,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
  test: {
    include: ["src/**/*.test.{js,jsx}"],
  },
});
