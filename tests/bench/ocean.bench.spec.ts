import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const seconds = Number(process.env.BENCH_SECONDS ?? 60);
const quality = process.env.BENCH_QUALITY ?? "high";
const scene = process.env.BENCH_SCENE ?? "ocean";
const runs = Number(process.env.BENCH_RUNS ?? 3);

test(`${scene} benchmark (${runs}× ${seconds}s, quality ${quality})`, async ({ page }) => {
  const results: unknown[] = [];
  for (let i = 0; i < runs; i++) {
    await page.goto(`/?bench=${scene}&seconds=${seconds}&quality=${quality}&net=0`);
    await page.waitForFunction(
      () => (window as unknown as { __OCEAN_BENCH__?: unknown }).__OCEAN_BENCH__,
      null,
      {
        timeout: (seconds + 30) * 1000,
        polling: 1000,
      },
    );
    results.push(
      await page.evaluate(
        () => (window as unknown as { __OCEAN_BENCH__: unknown }).__OCEAN_BENCH__,
      ),
    );
  }
  const fps = results.map((r) => (r as { fpsAvg: number }).fpsAvg).sort((a, b) => a - b);
  const median = fps[Math.floor(fps.length / 2)];
  const summary = { date: new Date().toISOString(), runs: results, medianFpsAvg: median };
  mkdirSync("bench-results", { recursive: true });
  const file = join("bench-results", `${scene}-${quality}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved ${file}`);
  expect(results.length).toBe(runs);
});
