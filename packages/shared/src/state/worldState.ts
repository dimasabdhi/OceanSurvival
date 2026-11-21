/**
 * Replicated world state (Schema v5 builder; ≤ 63 fields per schema).
 * Shared so the client gets typed state and the reconciler mirrors the same fields
 * the server simulates. See docs/MULTIPLAYER_DESIGN.md §8.
 */
import { type SchemaType, schema, t } from "@colyseus/schema";

export const PlayerState = schema(
  {
    /** Public player id (never the secret token). */
    playerId: t.string(),
    name: t.string(),
    // Simulation fields — exactly CHARACTER_STATE_FIELDS (movement/characterMovement.ts).
    x: t.float32().default(0),
    y: t.float32().default(0),
    z: t.float32().default(0),
    vy: t.float32().default(0),
    yaw: t.float32().default(0),
    pitch: t.float32().default(0),
    mode: t.uint8().default(0),
    /** False while the client is inside its reconnection grace period. */
    connected: t.boolean().default(true),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

/**
 * The raft's motion in the WORLD (ADR-0014): world position at `originTime` plus a
 * constant velocity. Players are simulated relative to the raft; this is used for
 * rendering the ocean/sky around it (and later world spawns). See raftWorldPosition().
 */
export const RaftState = schema(
  {
    originX: t.float64().default(0),
    originZ: t.float64().default(0),
    /** World time (s) at which the raft was at (originX, originZ). */
    originTime: t.float64().default(0),
    velX: t.float32().default(0),
    velZ: t.float32().default(0),
    /** Lantern on the raft (Phase 3 interaction demo). */
    lanternOn: t.boolean().default(false),
  },
  "RaftState",
);
export type RaftState = SchemaType<typeof RaftState>;

/**
 * A floating debris piece (GAMEPLAY_SYSTEMS §C). Static in the WORLD (it floats with the
 * water); clients render it at world − raftWorld(t). Nothing changes after spawning.
 */
export const Debris = schema(
  {
    kind: t.uint8(),
    worldX: t.float64(),
    worldZ: t.float64(),
    /** World time of spawning (fade-in, lifetime). */
    spawnTime: t.float64(),
    /** Visual yaw (radians). */
    yaw: t.float32(),
  },
  "Debris",
);
export type Debris = SchemaType<typeof Debris>;

export const WorldState = schema(
  {
    worldId: t.string(),
    /** World time (s) at room clock 0. World time = timeOrigin + room clock seconds. */
    timeOrigin: t.float64().default(0),
    /** Keyed by Colyseus sessionId. */
    players: t.map(PlayerState),
    raft: t.ref(RaftState),
    /** Per-client filtered by distance (StateView AOI, DEBRIS.aoiRadius). Keyed by id. */
    debris: t.map(Debris).view(),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
