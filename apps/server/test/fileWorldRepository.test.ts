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
  formatVersion: 2,
  raft: { worldX: 12, worldZ: -340, lanternOn: true },
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

  it("migrates a Phase 2 (v1) save: keeps players, clears positions, adds the raft", async () => {
    const dir = tempDir();
    await mkdir(join(dir, "worlds"), { recursive: true });
    const v1 = { ...snapshot(77), formatVersion: 1 } as Record<string, unknown>;
    delete v1.raft;
    writeFileSync(join(dir, "worlds", "test-world.json"), JSON.stringify(v1));
    const loaded = await new FileWorldRepository(dir).loadWorld("test-world");
    expect(loaded?.formatVersion).toBe(2);
    expect(loaded?.worldTime).toBe(77);
    expect(loaded?.players.abcdefghijklmnop?.name).toBe("Dimas");
    expect(loaded?.players.abcdefghijklmnop?.position).toBeNull();
    expect(loaded?.raft).toEqual({ worldX: 0, worldZ: 0, lanternOn: false });
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
