import {
  createPrng,
  DEBRIS,
  debrisSpawnPosition,
  pickDebrisKind,
  RAFT_VELOCITY,
} from "@oceansurvival/shared";
import type { DebrisLike } from "./DebrisRenderer";

/**
 * Offline / menu / benchmark only: a client-side stand-in for the server's debris field
 * (same spawn rules, same drift), so the ocean is populated without a server. Online,
 * the replicated `state.debris` is rendered instead.
 */
export class LocalDebrisField {
  private readonly items: DebrisLike[] = [];
  private readonly rand = createPrng(4242);
  private nextSpawn = 0;

  constructor(private readonly count = DEBRIS.maxActive) {}

  /** Keeps `count` pieces alive around a raft drifting from the origin at RAFT_VELOCITY. */
  update(worldTime: number): DebrisLike[] {
    if (this.items.length === 0) {
      for (let i = 0; i < this.count; i++)
        this.spawn(worldTime - this.rand() * DEBRIS.lifetimeSeconds);
      this.nextSpawn = worldTime;
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      if (d && worldTime - d.spawnTime > DEBRIS.lifetimeSeconds) this.items.splice(i, 1);
    }
    const interval = DEBRIS.lifetimeSeconds / this.count;
    while (this.nextSpawn <= worldTime) {
      if (this.items.length < this.count) this.spawn(this.nextSpawn);
      this.nextSpawn += interval;
    }
    return this.items;
  }

  private spawn(spawnTime: number): void {
    const rx = RAFT_VELOCITY[0] * spawnTime;
    const rz = RAFT_VELOCITY[1] * spawnTime;
    const [worldX, worldZ] = debrisSpawnPosition(rx, rz, this.rand(), this.rand());
    this.items.push({
      kind: pickDebrisKind(this.rand()),
      worldX,
      worldZ,
      spawnTime,
      yaw: this.rand() * Math.PI * 2,
    });
  }
}
