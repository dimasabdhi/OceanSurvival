/**
 * The starting raft (GDD §8, ART_DIRECTION §6) and the raft-relative frame (ADR-0014).
 *
 * All player simulation happens in RAFT-LOCAL coordinates: the raft is static at the
 * origin, its deck top at y = RAFT_DECK_Y; water flows past at WATER_FLOW. The raft's
 * position in the world is only used for rendering (and later, world spawns).
 *
 * Phase 3: a fixed 2×2 foundation raft + a lantern post. The building system (Phase 7)
 * replaces the fixed layout with replicated pieces.
 */

export interface BoxDef {
  /** Center position (m). */
  center: readonly [number, number, number];
  /** Half extents (m). */
  halfExtents: readonly [number, number, number];
}

/** Building grid cell (GDD §8). */
export const CELL_SIZE = 1.5;
export const FOUNDATION_THICKNESS = 0.35;
/** Deck height above mean sea level (ART_DIRECTION §6 freeboard). */
export const RAFT_DECK_Y = 0.25;

/** Raft velocity through the water, in the raft/world frame (m/s). Phase 3: constant drift. */
export const RAFT_VELOCITY: readonly [number, number] = [0, -0.6];
/** Water velocity as seen from the raft: the inverse of the raft's motion (m/s, x/z). */
export const WATER_FLOW: readonly [number, number] = [-RAFT_VELOCITY[0], -RAFT_VELOCITY[1]];

/** Foundation cells (grid x, z) of the starting raft, centered on the origin. */
export const START_RAFT_CELLS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/** Local center of a foundation cell; the 2×2 raft is centered on (0, 0). */
export function cellCenter(gx: number, gz: number): [number, number] {
  return [(gx - 0.5) * CELL_SIZE, (gz - 0.5) * CELL_SIZE];
}

export const LANTERN_ID = "lantern-1";
/** Lantern post on the raft's +x/+z corner (local, base on the deck). */
export const LANTERN_POSITION: readonly [number, number, number] = [1.2, RAFT_DECK_Y, 1.2];
/** Height of the lantern's glass (interaction target point) above its base. */
export const LANTERN_HEIGHT = 1.1;

function foundationBoxes(): BoxDef[] {
  return START_RAFT_CELLS.map(([gx, gz]) => {
    const [cx, cz] = cellCenter(gx, gz);
    return {
      center: [cx, RAFT_DECK_Y - FOUNDATION_THICKNESS / 2, cz],
      halfExtents: [CELL_SIZE / 2, FOUNDATION_THICKNESS / 2, CELL_SIZE / 2],
    };
  });
}

/** Static collision geometry of the raft in the raft frame. */
export const RAFT_COLLIDERS: readonly BoxDef[] = [
  ...foundationBoxes(),
  // Lantern post: thin pole players cannot walk through.
  {
    center: [LANTERN_POSITION[0], RAFT_DECK_Y + LANTERN_HEIGHT / 2, LANTERN_POSITION[2]],
    halfExtents: [0.08, LANTERN_HEIGHT / 2, 0.08],
  },
];

/** (x, z) spawn positions on the deck, used round-robin. */
export const RAFT_SPAWN_POINTS: readonly (readonly [number, number])[] = [
  [-0.6, -0.6],
  [0.6, -0.6],
  [-0.6, 0.6],
  [0.2, 0.2],
];

/** Raft position in the world at `worldTime` (rendering / world spawns only). */
export function raftWorldPosition(
  raft: { originX: number; originZ: number; originTime: number; velX: number; velZ: number },
  worldTime: number,
  out: [number, number] = [0, 0],
): [number, number] {
  const dt = worldTime - raft.originTime;
  out[0] = raft.originX + raft.velX * dt;
  out[1] = raft.originZ + raft.velZ * dt;
  return out;
}
