/**
 * Bot load test (ACCEPTANCE_CRITERIA Phase 2, PERFORMANCE_BUDGET §3–4).
 *
 * N headless bots join a dedicated world on a RUNNING dev server and behave like real
 * clients: one input per fixed step (60/s), random walking, sprinting, jumping and
 * turning. At the end the server's /debug/metrics are printed (tick time, bandwidth).
 *
 *   pnpm load-test                         (4 bots, 600 s, world "loadtest")
 *   $env:BOTS=8; $env:DURATION_SECONDS=120; pnpm load-test
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client, type Room } from "@colyseus/sdk";
import { Buttons, SIM_TICK_RATE, WORLD_ROOM_NAME } from "@oceansurvival/shared";

const SERVER = process.env.SERVER_URL ?? "http://127.0.0.1:2567";
const BOTS = Number(process.env.BOTS ?? 4);
const SECONDS = Number(process.env.DURATION_SECONDS ?? 600);
const WORLD = process.env.WORLD ?? "loadtest";
const STEP_MS = 1000 / SIM_TICK_RATE;

interface Bot {
  name: string;
  room: Room;
  sent: number;
  plan: { moveX: number; moveZ: number; yaw: number; buttons: number; until: number };
}

function newPlan(now: number) {
  const r = Math.random;
  return {
    moveX: Math.round(r() * 2 - 1),
    moveZ: r() < 0.7 ? 1 : Math.round(r() * 2 - 1),
    yaw: Math.fround((r() * 2 - 1) * Math.PI),
    buttons: (r() < 0.4 ? Buttons.Sprint : 0) | (r() < 0.2 ? Buttons.Jump : 0),
    until: now + 500 + r() * 2500,
  };
}

async function main(): Promise<void> {
  console.log(`load-test: ${BOTS} bots, ${SECONDS}s, world "${WORLD}" on ${SERVER}`);
  const bots: Bot[] = [];
  for (let i = 0; i < BOTS; i++) {
    const client = new Client(SERVER);
    const name = `Bot${i + 1}`;
    const room = await client.joinOrCreate(WORLD_ROOM_NAME, {
      worldId: WORLD,
      playerId: randomBytes(12).toString("base64url").slice(0, 16),
      token: randomBytes(32).toString("hex"),
      name,
    });
    bots.push({ name, room, sent: 0, plan: newPlan(performance.now()) });
  }
  console.log(`load-test: ${bots.length} bots joined`);

  const started = performance.now();
  let nextStep = started;
  let lastReport = started;
  while (performance.now() - started < SECONDS * 1000) {
    const now = performance.now();
    // Send every fixed step that is due (catch up if the timer was late).
    while (nextStep <= now) {
      for (const bot of bots) {
        if (now > bot.plan.until) bot.plan = newPlan(now);
        const data = bot.room.input().data as Record<string, number>;
        data.moveX = bot.plan.moveX;
        data.moveZ = bot.plan.moveZ;
        data.yaw = bot.plan.yaw;
        data.pitch = 0;
        // Jump is a short press: only on the first steps of a plan.
        data.buttons = bot.plan.buttons & (now < bot.plan.until - 2000 ? 3 : Buttons.Sprint);
        bot.room.input().send();
        bot.sent++;
      }
      nextStep += STEP_MS;
    }
    if (now - lastReport > 30_000) {
      lastReport = now;
      console.log(
        `load-test: ${Math.round((now - started) / 1000)}s, inputs sent ${bots[0]?.sent}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2));
  }

  const metrics = (await (await fetch(`${SERVER}/debug/metrics`)).json()) as {
    rooms: { worldId: string }[];
  };
  const room = metrics.rooms.find((r) => r.worldId === WORLD);
  const elapsed = (performance.now() - started) / 1000;
  const summary = {
    date: new Date().toISOString(),
    bots: BOTS,
    seconds: Math.round(elapsed),
    inputsPerBotPerSecond: Math.round(((bots[0]?.sent ?? 0) / elapsed) * 10) / 10,
    server: room ?? null,
  };
  console.log(JSON.stringify(summary, null, 2));
  mkdirSync("bench-results", { recursive: true });
  const file = join("bench-results", `load-${BOTS}bots-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(summary, null, 2));
  console.log(`Saved ${file}`);

  for (const bot of bots) await bot.room.leave();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
