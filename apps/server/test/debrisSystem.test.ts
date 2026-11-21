import {
  DEBRIS,
  distanceAheadOfRaft,
  RAFT_VELOCITY,
  raftWorldPosition,
  WorldState,
} from "@oceansurvival/shared";
import { describe, expect, it } from "vitest";
import { type AoiView, DebrisSystem } from "../src/sim/DebrisSystem";

/** Minimal stand-in for StateView (the real one needs a room encoder; see worldRoom.test). */
class FakeView implements AoiView {
  private readonly items = new Set<object>();
  has(i: object) {
    return this.items.has(i);
  }
  add(i: object) {
    this.items.add(i);
  }
  remove(i: object) {
    this.items.delete(i);
  }
}

function world(): WorldState {
  const s = new WorldState();
  s.raft.velX = RAFT_VELOCITY[0];
  s.raft.velZ = RAFT_VELOCITY[1];
  return s;
}

describe("DebrisSystem", () => {
  it("spawns at the GDD rate ahead of the raft and respects the cap", () => {
    const state = world();
    const sys = new DebrisSystem(state, "test");
    // 60 s with 1 player at 60 Hz.
    for (let i = 1; i <= 3600; i++) sys.update(i / 60, 1 / 60, 1);
    // 60 s / 2.2 s ≈ 27 pieces (none old enough to despawn yet).
    expect(state.debris.size).toBeGreaterThanOrEqual(26);
    expect(state.debris.size).toBeLessThanOrEqual(28);
    for (const d of state.debris.values()) {
      const [rx, rz] = raftWorldPosition(state.raft, d.spawnTime);
      const ahead = distanceAheadOfRaft(d.worldX, d.worldZ, rx, rz);
      expect(ahead).toBeGreaterThanOrEqual(DEBRIS.spawnMinAhead - 1e-6);
      expect(ahead).toBeLessThanOrEqual(DEBRIS.spawnMaxAhead + 1e-6);
    }
    // Long run with 4 players: never above the cap.
    for (let i = 3601; i <= 3600 * 6; i++) {
      sys.update(i / 60, 1 / 60, 4);
      expect(state.debris.size).toBeLessThanOrEqual(DEBRIS.maxActive);
    }
  });

  it("despawns by age (lifetime) and nothing older survives", () => {
    const state = world();
    const sys = new DebrisSystem(state, "test");
    for (let i = 1; i <= 60 * 400; i++) sys.update(i / 60, 1 / 60, 1);
    const now = 400;
    for (const d of state.debris.values()) {
      expect(now - d.spawnTime).toBeLessThanOrEqual(DEBRIS.lifetimeSeconds + 1 / 60);
    }
  });

  it("prefill creates a populated ocean with plausible ages", () => {
    const state = world();
    const sys = new DebrisSystem(state, "test");
    sys.prefill(1000);
    expect(state.debris.size).toBeGreaterThan(DEBRIS.maxActive * 0.4);
    for (const d of state.debris.values()) {
      expect(1000 - d.spawnTime).toBeGreaterThanOrEqual(0);
      expect(1000 - d.spawnTime).toBeLessThanOrEqual(DEBRIS.lifetimeSeconds);
    }
  });

  it("is deterministic per world seed", () => {
    const a = world();
    const b = world();
    new DebrisSystem(a, "same").prefill(500);
    new DebrisSystem(b, "same").prefill(500);
    expect(a.debris.toJSON()).toEqual(b.debris.toJSON());
  });

  it("AOI: a viewer only sees debris within the radius (with hysteresis)", () => {
    const state = world();
    const sys = new DebrisSystem(state, "test");
    sys.prefill(1000);
    const near = { view: new FakeView(), x: 0, z: 0 };
    const far = { view: new FakeView(), x: 190, z: 0 };
    sys.updateViews(1000, [near, far]);
    const seen = (v: AoiView) => [...state.debris.values()].filter((d) => v.has(d)).length;
    expect(seen(near.view)).toBe(state.debris.size); // all spawn within 90 m of the raft
    expect(seen(far.view)).toBe(0); // ≥ 155 m away laterally
    // Move the far viewer next to the raft: it now sees everything.
    far.x = 0;
    sys.updateViews(1000, [far]);
    expect(seen(far.view)).toBe(state.debris.size);
  });
});
