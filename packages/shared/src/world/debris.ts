/**
 * Floating debris (GDD §6, GAMEPLAY_SYSTEMS §C). Data + pure helpers shared by server
 * (spawning, despawning, hook catching later) and client (rendering).
 *
 * Debris floats still in the WATER (world frame). The raft drifts through it, so in the
 * raft frame it flows past at WATER_FLOW. Its position never changes after spawning, so
 * no movement is replicated: clients compute `world − raftWorld(t)` themselves.
 */
import { RAFT_VELOCITY } from "./raft";

export const DebrisKind = {
  Driftwood: 0,
  Plastic: 1,
  Seagrass: 2,
  Barrel: 3,
  Coconut: 4,
} as const;
export type DebrisKind = (typeof DebrisKind)[keyof typeof DebrisKind];

export interface DebrisKindDef {
  kind: DebrisKind;
  /** Item id it becomes when collected (inventory, Phase 6). */
  itemId: string;
  /** Spawn weight (GDD §6 distribution, in %). */
  weight: number;
  /** Catch radius for the hook (Phase 5), meters. */
  radius: number;
}

export const DEBRIS_KINDS: readonly DebrisKindDef[] = [
  { kind: DebrisKind.Driftwood, itemId: "driftwood", weight: 40, radius: 0.6 },
  { kind: DebrisKind.Plastic, itemId: "flotsam_plastic", weight: 30, radius: 0.45 },
  { kind: DebrisKind.Seagrass, itemId: "seagrass", weight: 22, radius: 0.5 },
  { kind: DebrisKind.Barrel, itemId: "barrel", weight: 5, radius: 0.6 },
  { kind: DebrisKind.Coconut, itemId: "coconut", weight: 3, radius: 0.3 },
];

export const DEBRIS = {
  /** Base spawn interval for one player (s). */
  spawnIntervalSeconds: 2.2,
  /** Each extra player speeds spawning up by this fraction. */
  perExtraPlayer: 0.25,
  maxActive: 60,
  /** Spawn band ahead of the raft (m, along the raft's heading). */
  spawnMinAhead: 40,
  spawnMaxAhead: 90,
  /** Lateral spread either side of the raft's path (m). */
  spawnLateral: 35,
  lifetimeSeconds: 180,
  /** Despawn once this far behind the raft (m). */
  despawnBehind: 120,
  /** Replication radius around each player (StateView AOI) + hysteresis (m). */
  aoiRadius: 120,
  aoiHysteresis: 10,
  /** Visual fade-in/out duration (s). */
  fadeSeconds: 1.5,
} as const;

/** Spawn interval for `players` connected players (s). */
export function debrisSpawnInterval(players: number): number {
  return DEBRIS.spawnIntervalSeconds / (1 + DEBRIS.perExtraPlayer * Math.max(0, players - 1));
}

/** Picks a kind using the GDD weights; `r` in [0, 1). */
export function pickDebrisKind(r: number): DebrisKind {
  const total = DEBRIS_KINDS.reduce((s, k) => s + k.weight, 0);
  let x = r * total;
  for (const k of DEBRIS_KINDS) {
    x -= k.weight;
    if (x < 0) return k.kind;
  }
  return DebrisKind.Driftwood;
}

const heading = (() => {
  const len = Math.hypot(RAFT_VELOCITY[0], RAFT_VELOCITY[1]) || 1;
  return [RAFT_VELOCITY[0] / len, RAFT_VELOCITY[1] / len] as const;
})();

/** Unit vector of the raft's travel direction in the world (x, z). */
export function raftHeading(): readonly [number, number] {
  return heading;
}

/**
 * World position for a new debris piece ahead of the raft.
 * `ahead` and `lateral` in [0, 1) select a point in the spawn band.
 */
export function debrisSpawnPosition(
  raftWorldX: number,
  raftWorldZ: number,
  ahead: number,
  lateral: number,
): [number, number] {
  const [hx, hz] = heading;
  const d = DEBRIS.spawnMinAhead + ahead * (DEBRIS.spawnMaxAhead - DEBRIS.spawnMinAhead);
  const l = (lateral * 2 - 1) * DEBRIS.spawnLateral;
  // perpendicular (right of heading): (−hz, hx)
  return [raftWorldX + hx * d - hz * l, raftWorldZ + hz * d + hx * l];
}

/** Signed distance of a world point ahead (+) / behind (−) the raft along its heading. */
export function distanceAheadOfRaft(
  worldX: number,
  worldZ: number,
  raftWorldX: number,
  raftWorldZ: number,
): number {
  return (worldX - raftWorldX) * heading[0] + (worldZ - raftWorldZ) * heading[1];
}
