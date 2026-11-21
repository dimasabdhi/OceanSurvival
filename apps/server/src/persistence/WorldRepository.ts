import { z } from "zod";

/**
 * Persistence boundary (docs/DATABASE_DESIGN.md §1, ADR-0007).
 * Phase 2: memory/file drivers. Phase 8 adds PostgreSQL behind the same interface.
 */

/** Current save format. Older saves are migrated on load (see parseSnapshot). */
export const SAVE_FORMAT_VERSION = 2;

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
  /** Phase 5 temporary bag (item id → count); optional, absent in older saves. */
  carried: z.record(z.string(), z.number().int().nonnegative()).optional(),
  lastSeenAt: z.iso.datetime(),
});
export type PlayerRecord = z.infer<typeof PlayerRecord>;

/** Phase 2 format: player positions were relative to the static test deck. */
export const WorldSnapshotV1 = z.object({
  formatVersion: z.literal(1),
  worldId: z.string(),
  worldTime: z.number().finite().nonnegative(),
  savedAt: z.iso.datetime(),
  players: z.record(z.string(), PlayerRecord),
});

/** Phase 3 format: player positions are in the raft frame (ADR-0014) + raft world state. */
export const WorldSnapshotV2 = z.object({
  formatVersion: z.literal(2),
  worldId: z.string(),
  worldTime: z.number().finite().nonnegative(),
  savedAt: z.iso.datetime(),
  players: z.record(z.string(), PlayerRecord),
  raft: z.object({
    /** Raft position in the world at `worldTime`. */
    worldX: z.number().finite(),
    worldZ: z.number().finite(),
    lanternOn: z.boolean(),
  }),
});
export type WorldSnapshot = z.infer<typeof WorldSnapshotV2>;

/**
 * Validates a stored snapshot of ANY known format and migrates it to the current one.
 * Throws on unknown/corrupt data (never silently resets a world).
 */
export function parseSnapshot(raw: unknown): WorldSnapshot {
  const version = (raw as { formatVersion?: unknown } | null)?.formatVersion;
  if (version === 1) return migrateV1toV2(WorldSnapshotV1.parse(raw));
  if (version === 2) return WorldSnapshotV2.parse(raw);
  throw new Error(`Unknown save formatVersion: ${String(version)}`);
}

/**
 * v1 → v2: the Phase 2 test deck no longer exists, so saved positions would put players
 * in mid-air or far from the raft. Positions are cleared (players respawn on the raft);
 * names and identities are kept. The raft starts at the world origin, lantern off.
 */
function migrateV1toV2(v1: z.infer<typeof WorldSnapshotV1>): WorldSnapshot {
  const players: Record<string, PlayerRecord> = {};
  for (const [id, p] of Object.entries(v1.players)) players[id] = { ...p, position: null };
  return {
    formatVersion: 2,
    worldId: v1.worldId,
    worldTime: v1.worldTime,
    savedAt: v1.savedAt,
    players,
    raft: { worldX: 0, worldZ: 0, lanternOn: false },
  };
}

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
    return raw ? parseSnapshot(JSON.parse(raw)) : null;
  }
  async saveWorld(snapshot: WorldSnapshot): Promise<void> {
    this.worlds.set(snapshot.worldId, JSON.stringify(WorldSnapshotV2.parse(snapshot)));
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
