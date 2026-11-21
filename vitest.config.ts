import { defineConfig } from "vitest/config";

// Unit + integration tests for all workspace packages (Node environment).
// Browser/E2E tests live in tests/e2e and run with Playwright.
export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/server/test/**/*.test.ts",
      "tools/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
