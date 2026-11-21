import { describe, expect, it } from "vitest";
import { createPrng } from "../math/prng";
import {
  DEBRIS,
  DEBRIS_KINDS,
  DebrisKind,
  debrisSpawnInterval,
  debrisSpawnPosition,
  distanceAheadOfRaft,
  pickDebrisKind,
} from "./debris";

describe("debris rules", () => {
  it("kind distribution follows the GDD weights", () => {
    const rand = createPrng(5);
    const counts = new Map<number, number>();
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const k = pickDebrisKind(rand());
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const def of DEBRIS_KINDS) {
      expect(((counts.get(def.kind) ?? 0) / n) * 100).toBeCloseTo(def.weight, 0);
    }
  });

  it("spawns inside the band ahead of the raft", () => {
    const rand = createPrng(9);
    for (let i = 0; i < 1000; i++) {
      const [x, z] = debrisSpawnPosition(500, -2000, rand(), rand());
      const ahead = distanceAheadOfRaft(x, z, 500, -2000);
      expect(ahead).toBeGreaterThanOrEqual(DEBRIS.spawnMinAhead - 1e-9);
      expect(ahead).toBeLessThanOrEqual(DEBRIS.spawnMaxAhead + 1e-9);
      const lateral = Math.sqrt(Math.max(0, (x - 500) ** 2 + (z + 2000) ** 2 - ahead ** 2));
      expect(lateral).toBeLessThanOrEqual(DEBRIS.spawnLateral + 1e-6);
    }
  });

  it("more players spawn more debris (GAMEPLAY_SYSTEMS §C)", () => {
    expect(debrisSpawnInterval(1)).toBeCloseTo(2.2);
    expect(debrisSpawnInterval(4)).toBeCloseTo(2.2 / 1.75);
  });

  it("covers all kinds", () => {
    expect(DEBRIS_KINDS.map((k) => k.kind).sort()).toEqual(Object.values(DebrisKind).sort());
  });
});
