import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileWorldRepository } from "../src/persistence/FileWorldRepository";
import type { WorldSnapshot } from "../src/persistence/WorldRepository";

const dirs: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "os-saves-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const snapshot = (worldTime: number): WorldSnapshot => ({
  formatVersion: 1,
  worldId: "test-world",
  worldTime,
  savedAt: new Date().toISOString(),
  players: {
    abcdefghijklmnop: {
      playerId: "abcdefghijklmnop",
      name: "Dimas",
      position: { x: 1, y: 1.5, z: -2, yaw: 0.5 },
      lastSeenAt: new Date().toISOString(),
    },
  },
});

describe("FileWorldRepository", () => {
  it("returns null for a world that was never saved", async () => {
    expect(await new FileWorldRepository(tempDir()).loadWorld("test-world")).toBeNull();
  });

  it("round-trips a snapshot and leaves no temp files behind", async () => {
    const dir = tempDir();
    const repo = new FileWorldRepository(dir);
    await repo.saveWorld(snapshot(100));
    const loaded = await repo.loadWorld("test-world");
    expect(loaded?.worldTime).toBe(100);
    expect(loaded?.players.abcdefghijklmnop?.position?.z).toBe(-2);
    expect(readdirSync(join(dir, "worlds"))).toEqual(["test-world.json"]);
  });

  it("serializes concurrent saves: the last write wins, file stays valid JSON", async () => {
    const dir = tempDir();
    const repo = new FileWorldRepository(dir);
    await Promise.all(Array.from({ length: 20 }, (_, i) => repo.saveWorld(snapshot(i))));
    const raw = readFileSync(join(dir, "worlds", "test-world.json"), "utf8");
    expect(JSON.parse(raw).worldTime).toBe(19);
  });

  it("refuses to load a corrupt save instead of silently resetting the world", async () => {
    const dir = tempDir();
    await mkdir(join(dir, "worlds"), { recursive: true });
    writeFileSync(join(dir, "worlds", "test-world.json"), JSON.stringify({ formatVersion: 99 }));
    await expect(new FileWorldRepository(dir).loadWorld("test-world")).rejects.toThrow(/Corrupt/);
  });

  it("rejects path-traversal world ids", async () => {
    const repo = new FileWorldRepository(tempDir());
    await expect(repo.loadWorld("../../etc")).rejects.toThrow(/invalid worldId/);
  });

  it("identity registration is first-come and race-safe", async () => {
    const repo = new FileWorldRepository(tempDir());
    const base = { playerId: "abcdefghijklmnop", createdAt: new Date().toISOString() };
    const results = await Promise.all([
      repo.createIdentity({ ...base, tokenHash: "a".repeat(64) }),
      repo.createIdentity({ ...base, tokenHash: "b".repeat(64) }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await repo.getIdentity("abcdefghijklmnop"))?.tokenHash).toBe("a".repeat(64));
  });
});
