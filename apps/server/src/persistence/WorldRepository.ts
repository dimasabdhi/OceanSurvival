import { z } from "zod";

/**
 * Persistence boundary (docs/DATABASE_DESIGN.md §1, ADR-0007).
 * Phase 2: memory/file drivers. Phase 8 adds PostgreSQL behind the same interface.
 */

export const SAVE_FORMAT_VERSION = 1;

export const SavedPosition = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  yaw: z.number().finite(),
});

export const PlayerRecord = z.object({
  playerId: z.string(),
  name: z.string(),
  position: SavedPosition.nullable(),
  lastSeenAt: z.iso.datetime(),
});
export type PlayerRecord = z.infer<typeof PlayerRecord>;

export const WorldSnapshotV1 = z.object({
  formatVersion: z.literal(1),
  worldId: z.string(),
  worldTime: z.number().finite().nonnegative(),
  savedAt: z.iso.datetime(),
  players: z.record(z.string(), PlayerRecord),
});
export type WorldSnapshot = z.infer<typeof WorldSnapshotV1>;

export const PlayerIdentity = z.object({
  playerId: z.string(),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(),
});
export type PlayerIdentity = z.infer<typeof PlayerIdentity>;

export interface WorldRepository {
  loadWorld(worldId: string): Promise<WorldSnapshot | null>;
  saveWorld(snapshot: WorldSnapshot): Promise<void>;
  getIdentity(playerId: string): Promise<PlayerIdentity | null>;
  /** Stores a new identity. Returns false if the id is already taken (race-safe). */
  createIdentity(identity: PlayerIdentity): Promise<boolean>;
}

/** Volatile repository for tests and `PERSISTENCE_DRIVER=memory`. */
export class MemoryWorldRepository implements WorldRepository {
  private readonly worlds = new Map<string, string>();
  private readonly identities = new Map<string, PlayerIdentity>();

  async loadWorld(worldId: string): Promise<WorldSnapshot | null> {
    const raw = this.worlds.get(worldId);
    return raw ? WorldSnapshotV1.parse(JSON.parse(raw)) : null;
  }
  async saveWorld(snapshot: WorldSnapshot): Promise<void> {
    this.worlds.set(snapshot.worldId, JSON.stringify(WorldSnapshotV1.parse(snapshot)));
  }
  async getIdentity(playerId: string): Promise<PlayerIdentity | null> {
    return this.identities.get(playerId) ?? null;
  }
  async createIdentity(identity: PlayerIdentity): Promise<boolean> {
    if (this.identities.has(identity.playerId)) return false;
    this.identities.set(identity.playerId, identity);
    return true;
  }
}
