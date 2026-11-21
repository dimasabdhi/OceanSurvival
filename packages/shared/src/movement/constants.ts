/**
 * Player character tuning (GDD §4). Data, not scattered literals: tune here only.
 * Units: meters, seconds.
 */
export const CHARACTER = {
  /** Capsule: total height 1.8 m = 2 × halfHeight + 2 × radius. */
  radius: 0.35,
  halfHeight: 0.55,
  /** Eye height above the capsule center (eye at 1.62 m above the feet). */
  eyeOffset: 0.72,
  walkSpeed: 3.6,
  sprintSpeed: 5.6,
  swimSpeed: 2.4,
  /** Diving down / swimming up under water. */
  swimVerticalSpeed: 2.0,
  /** Passive float-up speed when under water and not diving. */
  swimRiseSpeed: 0.6,
  /** Jump apex ≈ 1.1 m: v = sqrt(2 g h). */
  jumpSpeed: 4.65,
  /** Leap out of the water onto a platform/raft edge (~2 m rise). */
  swimLeapSpeed: 6.4,
  gravity: 9.81,
  maxFallSpeed: 30,
  /** Character controller tuning (Rapier KCC). */
  skinOffset: 0.02,
  autostepHeight: 0.3,
  autostepMinWidth: 0.2,
  snapToGround: 0.3,
  maxSlopeDeg: 45,
  /** Pitch is clamped to ±89°. */
  maxPitch: (89 * Math.PI) / 180,
} as const;

/** Capsule center height above the feet. */
export const CHARACTER_CENTER_HEIGHT = CHARACTER.halfHeight + CHARACTER.radius;

/** Phase 2: flat mean sea level. Wave-following swimming arrives with the raft (Phase 3–4). */
export const WATER_LEVEL = 0;
/** While swimming, the capsule center floats this far below the water surface (head above water). */
export const SWIM_CENTER_DEPTH = 0.55;
/** Deepest a swimmer can dive (m below the swim depth). Oxygen arrives in Phase 9. */
export const MAX_DIVE_DEPTH = 25;
/** Below this the player is respawned at the spawn point (safety net). */
export const KILL_PLANE_Y = -60;

/** Movement modes replicated in state (`mode` field). */
export const MoveMode = {
  Grounded: 0,
  Airborne: 1,
  Swimming: 2,
  /** Swimming with the head under water. */
  Diving: 3,
} as const;
export type MoveMode = (typeof MoveMode)[keyof typeof MoveMode];

/** Input button bit flags (`buttons` field of the input schema). */
export const Buttons = {
  Jump: 1,
  Sprint: 2,
  /** Dive down while swimming (C). */
  Dive: 4,
} as const;
