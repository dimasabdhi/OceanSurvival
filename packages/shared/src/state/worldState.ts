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

export const WorldState = schema(
  {
    worldId: t.string(),
    /** World time (s) at room clock 0. World time = timeOrigin + room clock seconds. */
    timeOrigin: t.float64().default(0),
    /** Keyed by Colyseus sessionId. */
    players: t.map(PlayerState),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
