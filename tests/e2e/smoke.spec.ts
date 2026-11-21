import { expect, test } from "@playwright/test";
import { GOLDEN_RAPIER_HASH_600 } from "../../packages/shared/src/physics-spike/determinism";

/** Phase 1 smoke tests (Chrome + Edge). See docs/ACCEPTANCE_CRITERIA.md Phase 1. */

test("boots WebGL2, renders the ocean scene without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/?net=0");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.getByTestId("start-screen")).toBeVisible();
  await expect(page.getByTestId("perf-panel")).toBeVisible({ timeout: 10_000 });

  const info = await page.evaluate(() => {
    const dbg = (
      window as unknown as {
        __OS_DEBUG__: {
          game: { renderer: { info: { render: { calls: number; triangles: number } } } };
        };
      }
    ).__OS_DEBUG__;
    return { ...dbg.game.renderer.info.render };
  });
  expect(info.calls).toBeGreaterThanOrEqual(3); // sky + ocean + floaters
  expect(info.triangles).toBeGreaterThan(10_000);
  expect(errors).toEqual([]);
});

test("Rapier in the browser matches the Node.js golden hash", async ({ page }) => {
  await page.goto("/?spike=rapier&net=0");
  const spike = page.getByTestId("rapier-spike");
  await expect(spike).toBeVisible({ timeout: 30_000 });
  const result = await page.evaluate(
    () => (window as unknown as { __RAPIER_SPIKE__: { hash: string } }).__RAPIER_SPIKE__,
  );
  expect(result.hash).toBe(GOLDEN_RAPIER_HASH_600);
});

test("start → pointer lock → lock released → pause menu", async ({ page }) => {
  await page.goto("/?net=0");
  await page.getByTestId("start-screen").getByRole("button").click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null))
    .toBe("game-canvas");
  await expect(page.getByTestId("start-screen")).toBeHidden();
  // A real Esc key is handled by the browser itself (it exits pointer lock); synthetic
  // key events cannot trigger that, so we release the lock the same way the browser does.
  // The physical Esc key is covered by the manual test procedure (PHASE_01_REPORT).
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByTestId("pause-menu").getByRole("button").first().click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null))
    .toBe("game-canvas");
});
