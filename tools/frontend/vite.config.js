import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "./",
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    port: 18888,
    strictPort: true,
    proxy: {
      "/health": "http://127.0.0.1:18080",
      "/clean": "http://127.0.0.1:18080",
      "/penetration": "http://127.0.0.1:18080",
      "/profile": "http://127.0.0.1:18080",
      "/report": "http://127.0.0.1:18080",
      "/download": "http://127.0.0.1:18080",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist"),
    emptyOutDir: true,
  },
});
