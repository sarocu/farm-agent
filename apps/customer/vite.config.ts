import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The customer site is served on port 3000 in development.
  server: {
    port: 3000,
    // Proxy REST + uploaded-asset requests to the backend API on port 3001
    // so the browser can call `/api/...` and `/uploads/...` directly.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Allow `import "@farm/ui/styles.css"` to resolve to the built CSS.
      "@farm/ui/styles.css": resolve(
        __dirname,
        "../../packages/ui/dist/style.css",
      ),
    },
  },
});
