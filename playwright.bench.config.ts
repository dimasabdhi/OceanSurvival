import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Ocean benchmark (PERFORMANCE_BUDGET §7). Runs HEADED on the real GPU: a browser
 * window opens for ~1 minute — don't use the PC meanwhile. Results are written to
 * bench-results/ (git-ignored) and printed.
 *
 *   pnpm bench:ocean                       (Chrome, 60 s, quality high)
 *   $env:BENCH_SECONDS=30; pnpm bench:ocean
 */
export default defineConfig({
  ...base,
  testDir: "tests/bench",
  timeout: 15 * 60_000,
  use: {
    ...base.use,
    headless: false,
    viewport: { width: 1920, height: 1080 },
    launchOptions: { args: ["--start-maximized", "--disable-background-timer-throttling"] },
  },
  projects: [{ name: "chrome", use: { channel: "chrome" } }],
});
