/**
 * PLACEHOLDER (Phase 2 only): a static wooden test platform floating at the origin, so
 * players have something to stand on before the real raft exists (Phase 3 replaces it
 * with the raft as a moving, raft-local frame). Shared so client prediction and server
 * simulation collide against IDENTICAL geometry.
 */
export interface BoxDef {
  /** Center position (m). */
  center: readonly [number, number, number];
  /** Half extents (m). */
  halfExtents: readonly [number, number, number];
}

export const TEST_PLATFORM_TOP_Y = 0.6;

export const TEST_LEVEL: {
  readonly boxes: readonly BoxDef[];
  readonly spawnPoints: readonly (readonly [number, number])[];
} = {
  boxes: [
    // 8 m × 8 m deck, 0.4 m thick, top surface at y = 0.6
    { center: [0, TEST_PLATFORM_TOP_Y - 0.2, 0], halfExtents: [4, 0.2, 4] },
    // a crate to test stepping/jumping onto (0.5 m high: needs a jump)
    { center: [2.4, TEST_PLATFORM_TOP_Y + 0.25, -2.4], halfExtents: [0.5, 0.25, 0.5] },
    // a low step (0.25 m): walkable via autostep
    { center: [-2.4, TEST_PLATFORM_TOP_Y + 0.125, 2.4], halfExtents: [0.6, 0.125, 0.6] },
  ],
  /** (x, z) spawn positions on the deck, used round-robin. */
  spawnPoints: [
    [0, 0],
    [1.5, 0],
    [-1.5, 0],
    [0, 1.5],
  ],
};
