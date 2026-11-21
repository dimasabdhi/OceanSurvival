import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Phase 2 E2E: several players in real browser pages (separate contexts = separate
 * identities), server-authoritative movement, prediction, interpolation, chat.
 */
interface Debug {
  game: {
    join(name: string): void;
    sampler: { setActive(a: boolean): void; keys: Set<string>; yaw: number };
    connection: {
      sessionId: string;
      room: {
        state: { players: Map<string, { name: string; x: number; z: number; mode: number }> };
      };
    } | null;
  };
  store: {
    session: { value: { phase: string } };
    netStats: { value: { corrAvgCm: number; corrMaxCm: number } | null };
  };
}

async function joinAs(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  // A dedicated world keeps E2E runs away from the developer's own dev world.
  await page.goto("/?world=e2e");
  await page.getByTestId("name-input").fill(name);
  await page.getByTestId("join-button").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.store.session.value.phase,
      ),
    )
    .toBe("in-world");
  return page;
}

/** Position of `name` as seen in `page`'s replicated state. */
function seen(page: Page, name: string) {
  return page.evaluate((n) => {
    const c = (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.connection;
    const p = [...(c?.room.state.players.values() ?? [])].find((pl) => pl.name === n);
    return p ? { x: p.x, z: p.z, mode: p.mode } : null;
  }, name);
}

test("three players see each other move; prediction stays exact; chat works", async ({
  browser,
}) => {
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  const [a, b, c] = await Promise.all([
    joinAs(browser, `Alfa${suffix}`),
    joinAs(browser, `Bravo${suffix}`),
    joinAs(browser, `Charlie${suffix}`),
  ]);
  for (const page of [a, b, c]) {
    await expect(page.getByTestId("net-status")).toContainText("terhubung");
  }
  await expect.poll(() => seen(a, `Bravo${suffix}`)).not.toBeNull();
  await expect.poll(() => seen(c, `Alfa${suffix}`)).not.toBeNull();
  const start = await seen(a, `Bravo${suffix}`);

  // Bravo holds W for 1.2 s (pointer lock isn't needed: drive the input sampler).
  await b.evaluate(() => {
    const g = (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game;
    g.sampler.setActive(true);
    g.sampler.yaw = Math.PI / 2; // face -X
    g.sampler.keys.add("KeyW");
  });
  await b.waitForTimeout(1200);
  await b.evaluate(() => {
    (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.game.sampler.keys.delete("KeyW");
  });
  await b.waitForTimeout(800);

  // Alfa and Charlie both see Bravo moved ~4 m towards -X (server-authoritative).
  const fromA = await seen(a, `Bravo${suffix}`);
  const fromC = await seen(c, `Bravo${suffix}`);
  expect(start).not.toBeNull();
  expect((start?.x ?? 0) - (fromA?.x ?? 0)).toBeGreaterThan(2.5);
  expect(fromC?.x).toBeCloseTo(fromA?.x ?? Number.NaN, 2);

  // Bravo's own prediction needed (almost) no correction on localhost.
  const stats = await b.evaluate(
    () => (window as unknown as { __OS_DEBUG__: Debug }).__OS_DEBUG__.store.netStats.value,
  );
  expect(stats?.corrMaxCm ?? 0).toBeLessThan(5);

  // Chat: Charlie sends, Alfa receives.
  await c.keyboard.press("Enter").catch(() => undefined);
  await c.evaluate(() => {
    (
      window as unknown as { __OS_DEBUG__: { game: { sendChat(t: string): void } } }
    ).__OS_DEBUG__.game.sendChat("halo dari Charlie");
  });
  await expect(a.getByTestId("chat")).toContainText("halo dari Charlie");

  // Leave properly (consented): an abrupt close keeps the player in the world for the
  // reconnection grace period, which would fill the world for the next run.
  for (const page of [a, b, c]) {
    await page.evaluate(() =>
      (
        window as unknown as { __OS_DEBUG__: { game: { leaveWorld(): Promise<void> } } }
      ).__OS_DEBUG__.game.leaveWorld(),
    );
  }
  await Promise.all([a, b, c].map((p) => p.context().close()));
});
