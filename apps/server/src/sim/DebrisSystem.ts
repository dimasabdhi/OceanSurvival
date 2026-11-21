/**
 * Server-side debris lifecycle (GAMEPLAY_SYSTEMS §C): spawns pieces ahead of the
 * drifting raft, despawns them by age or once far behind, and keeps each client's
 * StateView limited to debris near that player (AOI).
 *
 * Pure bookkeeping over the replicated `debris` map; nothing moves per tick (debris is
 * static in the world, ADR-0014), so the steady-state network cost is spawn/despawn only.
 */
import {
  createPrng,
  DEBRIS,
  Debris,
  debrisSpawnInterval,
  debrisSpawnPosition,
  distanceAheadOfRaft,
  pickDebrisKind,
  raftWorldPosition,
  type WorldState,
} from "@oceansurvival/shared";

/** FNV-1a of a string → 32-bit seed (deterministic per world). */
function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The subset of Colyseus StateView used for AOI (a fake can be used in unit tests). */
export interface AoiView {
  has(instance: object): boolean;
  add(instance: object): unknown;
  remove(instance: object): unknown;
}

export interface AoiViewer {
  view: AoiView;
  /** Player position in the raft frame. */
  x: number;
  z: number;
}

export class DebrisSystem {
  private readonly rand: () => number;
  private nextId = 1;
  private spawnTimer = 0;
  private readonly raftPos: [number, number] = [0, 0];

  constructor(
    private readonly state: WorldState,
    seed: string,
  ) {
    this.rand = createPrng(seedFrom(seed));
  }

  /**
   * Fills the ocean as if debris had been spawning before the room opened, so a freshly
   * loaded world is not empty. Ages are spread over the lifetime.
   */
  prefill(worldTime: number, count = Math.round(DEBRIS.maxActive * 0.6)): void {
    for (let i = 0; i < count; i++) {
      const age = this.rand() * DEBRIS.lifetimeSeconds * 0.8;
      this.spawnAt(worldTime - age);
    }
    this.despawn(worldTime);
  }

  /** Advances spawning/despawning by `dt` seconds. */
  update(worldTime: number, dt: number, players: number): void {
    this.despawn(worldTime);
    if (players <= 0) return;
    this.spawnTimer += dt;
    const interval = debrisSpawnInterval(players);
    while (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      if (this.state.debris.size < DEBRIS.maxActive) this.spawnAt(worldTime);
    }
  }

  /**
   * Adds/removes debris from each viewer's StateView by distance (with hysteresis so
   * pieces at the edge do not flicker in and out).
   */
  updateViews(worldTime: number, viewers: Iterable<AoiViewer>): void {
    const [rx, rz] = raftWorldPosition(this.state.raft, worldTime, this.raftPos);
    const inR2 = DEBRIS.aoiRadius ** 2;
    const outR2 = (DEBRIS.aoiRadius + DEBRIS.aoiHysteresis) ** 2;
    for (const viewer of viewers) {
      for (const debris of this.state.debris.values()) {
        const dx = debris.worldX - rx - viewer.x;
        const dz = debris.worldZ - rz - viewer.z;
        const d2 = dx * dx + dz * dz;
        const visible = viewer.view.has(debris);
        if (!visible && d2 <= inR2) viewer.view.add(debris);
        else if (visible && d2 > outR2) viewer.view.remove(debris);
      }
    }
  }

  private spawnAt(spawnTime: number): void {
    const [rx, rz] = raftWorldPosition(this.state.raft, spawnTime, this.raftPos);
    const [wx, wz] = debrisSpawnPosition(rx, rz, this.rand(), this.rand());
    const d = new Debris();
    d.kind = pickDebrisKind(this.rand());
    d.worldX = wx;
    d.worldZ = wz;
    d.spawnTime = spawnTime;
    d.yaw = Math.fround(this.rand() * Math.PI * 2);
    this.state.debris.set(`d${this.nextId++}`, d);
  }

  private despawn(worldTime: number): void {
    const [rx, rz] = raftWorldPosition(this.state.raft, worldTime, this.raftPos);
    for (const [id, d] of this.state.debris) {
      if (d.hookId !== "") continue; // on a hook: owned by the HookSystem
      const old = worldTime - d.spawnTime > DEBRIS.lifetimeSeconds;
      const behind = distanceAheadOfRaft(d.worldX, d.worldZ, rx, rz) < -DEBRIS.despawnBehind;
      if (old || behind) this.state.debris.delete(id);
    }
  }
}
