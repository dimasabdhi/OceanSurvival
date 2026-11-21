/**
 * Simulation & replication rates. Single source of truth for client and server.
 * See docs/adr/0006-tick-and-replication-rates.md. Values are provisional until
 * the Phase 2–3 benchmarks lock them.
 */
export const SIM_TICK_RATE = 60;
export const FIXED_DT = 1 / SIM_TICK_RATE;
export const PATCH_RATE_MS = 50;
export const AI_TICK_EVERY_N_STEPS = 6; // 10 Hz at 60 Hz sim
export const VITALS_TICK_EVERY_N_STEPS = 30; // 2 Hz
export const WORLD_TICK_EVERY_N_STEPS = 60; // 1 Hz
export const REMOTE_INTERPOLATION_DELAY_MS = 100;

/** Maximum players per world room (raise only after load testing). */
export const DEFAULT_MAX_PLAYERS = 4;

/** Day/night cycle length in real seconds (GDD: 24 minutes; 16 day / 8 night). */
export const DAY_LENGTH_SECONDS = 24 * 60;
export const DAYLIGHT_FRACTION = 16 / 24;

/** World units are meters, Y-up. */
export const GRAVITY = -9.81;
