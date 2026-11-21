import { defineConfig } from "@playwright/test";

/**
 * E2E smoke tests. Uses the locally installed Chrome and Edge (channel), so no
 * Playwright browser download is needed. Starts the dev server + client if they
 * are not already running.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "msedge", use: { channel: "msedge" } },
  ],
  webServer: [
    {
      command: "pnpm dev:server",
      url: "http://localhost:2567/__healthcheck",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "pnpm dev:client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
