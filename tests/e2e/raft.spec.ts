import { expect, test } from "@playwright/test";

/** Phase 3 E2E: raft, interaction prompt + server-validated interaction, settings persistence. */
interface Debug {
  game: {
    sampler: { yaw: number; pitch: number };
    connection: {
      lanternOn: boolean;
      localPose(out: object): { x: number; y: number; z: number; mode: number } | null;
      leave(): Promise<void>;
    } | null;
    leaveWorld(): Promise<void>;
  };
  store: { session: { value: { phase: string } }; raftSway: { value: boolean } };
}

test("aim at the lantern → prompt → E toggles it (server-validated)", async ({ page }) => {
  await page.goto(`/?world=e2e-raft-${Math.floor(Math.random() * 1e6)}`);
  await page.getByTestId("name-input").fill("Penjaga");
  await page.getByTestId("join-button").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.store.session.value.phase,
      ),
    )
    .toBe("in-world");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id ?? null))
    .toBe("game-canvas");
  // Wait until the player stands on the raft.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.connection?.localPose({})
            ?.mode ?? -1,
      ),
    )
    .toBe(0);

  // Walk toward the lantern (interaction range is 2.5 m), then aim at its glass.
  const aim = () =>
    page.evaluate(() => {
      const g = (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game;
      const p = g.connection?.localPose({});
      if (!p) return 99;
      const eye = { x: p.x, y: p.y + 0.72, z: p.z };
      const target = { x: 1.2, y: 0.25 + 1.1, z: 1.2 };
      const dx = target.x - eye.x;
      const dy = target.y - eye.y;
      const dz = target.z - eye.z;
      g.sampler.yaw = Math.atan2(-dx, -dz);
      g.sampler.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      return Math.hypot(dx, dz);
    });
  await aim();
  await page.keyboard.down("KeyW");
  await expect.poll(aim, { intervals: [50] }).toBeLessThan(1.4);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const g = (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game;
    const p = g.connection?.localPose({});
    if (!p) return;
    const eye = { x: p.x, y: p.y + 0.72, z: p.z };
    const target = { x: 1.2, y: 0.25 + 1.1, z: 1.2 };
    const dx = target.x - eye.x;
    const dy = target.y - eye.y;
    const dz = target.z - eye.z;
    g.sampler.yaw = Math.atan2(-dx, -dz);
    g.sampler.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  });
  await expect(page.getByTestId("interact-prompt")).toContainText("Nyalakan lentera");
  await page.keyboard.press("KeyE");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.connection?.lanternOn,
      ),
    )
    .toBe(true);
  await expect(page.getByTestId("interact-prompt")).toContainText("Padamkan lentera");

  // Settings persist per browser.
  await page.evaluate(() => {
    (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.store.raftSway.value = false;
  });
  await page.evaluate(() =>
    (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.leaveWorld(),
  );
  await page.reload();
  expect(
    await page.evaluate(
      () => (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.store.raftSway.value,
    ),
  ).toBe(false);
});
