import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  // Share the repository-level .env (only VITE_* variables reach the browser).
  envDir: repoRoot,
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2023",
    sourcemap: true,
    chunkSizeWarningLimit: 4096,
  },
});
