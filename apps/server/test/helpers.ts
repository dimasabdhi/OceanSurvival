import { randomBytes } from "node:crypto";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { DEFAULT_WORLD_ID, WORLD_ROOM_NAME } from "@oceansurvival/shared";
import appConfig from "../src/app.config";
import { loadConfig } from "../src/config";
import { MemoryWorldRepository, type WorldRepository } from "../src/persistence/WorldRepository";
import type { WorldRoom } from "../src/rooms/WorldRoom";
import { configureServices } from "../src/services";

export interface TestPlayer {
  playerId: string;
  token: string;
  name: string;
}

let counter = 0;
export function newPlayer(name = `Tester${++counter}`): TestPlayer {
  const playerId = randomBytes(12).toString("base64url").slice(0, 16);
  return { playerId, token: randomBytes(32).toString("hex"), name };
}

export function joinOptions(p: TestPlayer, worldId = DEFAULT_WORLD_ID) {
  return { worldId, playerId: p.playerId, token: p.token, name: p.name };
}

export async function bootTestServer(
  env: Record<string, string> = {},
): Promise<{ colyseus: ColyseusTestServer; repository: WorldRepository }> {
  const repository = new MemoryWorldRepository();
  const config = loadConfig({
    NODE_ENV: "test",
    PERSISTENCE_DRIVER: "memory",
    DEBUG_ROUTES: "1",
    ...env,
  });
  configureServices(config, repository);
  const colyseus = await boot(appConfig);
  return { colyseus, repository };
}

export async function createWorld(
  colyseus: ColyseusTestServer,
  worldId = DEFAULT_WORLD_ID,
): Promise<WorldRoom> {
  return colyseus.createRoom<WorldRoom>(WORLD_ROOM_NAME, { worldId });
}

export function waitFor(predicate: () => boolean, timeoutMs = 5000, stepMs = 10): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error("waitFor timed out"));
      setTimeout(check, stepMs);
    };
    check();
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
