import { expect, test } from "@playwright/test";

/** Phase 5 E2E: real mouse input → charge → throw → hook lands → hold to reel back. */
interface Debug {
  game: {
    sampler: { yaw: number; pitch: number };
    connection: {
      sessionId: string;
      room: { state: { hooks: Map<string, { phase: number }> } };
      localPose(out: object): { mode: number } | null;
    } | null;
    leaveWorld(): Promise<void>;
  };
  store: { session: { value: { phase: string } }; hookCharge: { value: number | null } };
}

function ownHookPhase(): number {
  const g = (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game;
  const c = g.connection;
  return c?.room.state.hooks.get(c.sessionId)?.phase ?? -1;
}

test("hold to charge, release to throw, hold again to reel the hook back", async ({ page }) => {
  await page.goto(`/?world=e2e-hook-${Math.floor(Math.random() * 1e6)}`);
  await page.getByTestId("name-input").fill("Pengait");
  await page.getByTestId("join-button").click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null))
    .toBe("game-canvas");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.connection?.localPose({})
            ?.mode ?? -1,
      ),
    )
    .toBe(0);
  await page.evaluate(() => {
    (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.sampler.pitch = 0.1;
  });

  // Charge for ~0.6 s: the charge ring appears.
  await page.mouse.down();
  await expect(page.getByTestId("hook-charge")).toBeVisible();
  await page.waitForTimeout(600);
  await page.mouse.up();
  // Flying (0) → floating in the water (1).
  await expect.poll(() => page.evaluate(ownHookPhase), { timeout: 5000 }).toBe(1);

  // Hold to reel: Reeling (2) until it is back in hand (hook removed: -1).
  await page.mouse.down();
  await expect.poll(() => page.evaluate(ownHookPhase)).toBe(2);
  await expect.poll(() => page.evaluate(ownHookPhase), { timeout: 10_000 }).toBe(-1);
  await page.mouse.up();

  await page.evaluate(() =>
    (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.leaveWorld(),
  );
});
