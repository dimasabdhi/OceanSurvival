/**
 * Grapple Line (hook) rules — GAMEPLAY_SYSTEMS §C. Shared by server (authoritative
 * simulation) and client (charge UI, analytic flight rendering, rope).
 *
 * The flight is ANALYTIC: position = launch + velocity·t + ½·g·t², with the rope capping
 * horizontal reach at HOOK.maxRopeLength. Server and every client evaluate the same
 * function from the same replicated launch parameters, so remote players see a smooth
 * throw with no per-tick position updates. All positions are in the raft frame.
 */
import { z } from "zod";
import { WATER_LEVEL } from "./movement/constants";

export const HOOK = {
  /** Holding the throw button longer than this gives full power (s). */
  chargeSeconds: 1.2,
  /** Throw speed = minSpeed + power · extraSpeed (m/s). */
  minSpeed: 8,
  extraSpeed: 14,
  /** Extra upward speed so even a level throw arcs (m/s). */
  liftSpeed: 2.5,
  /** Horizontal reach of the rope from the launch point (m). */
  maxRopeLength: 25,
  /** The hook is released if it ends up farther than this from its owner (m). */
  cancelDistance: 30,
  /** Reeling speed through the water (m/s). */
  reelSpeed: 3.5,
  /** Debris within this distance of the hook gets caught (m). */
  catchRadius: 0.8,
  maxCaught: 3,
  /** Hook back in hand when this close to the owner's hand (m). */
  retrieveDistance: 1.5,
  /** Minimum time between throws (s). */
  throwCooldown: 0.5,
  gravity: 9.81,
} as const;

/** Hook lifecycle (replicated `phase`). */
export const HookPhase = {
  Flying: 0,
  Floating: 1,
  Reeling: 2,
} as const;
export type HookPhase = (typeof HookPhase)[keyof typeof HookPhase];

export const HookThrow = z.object({ power: z.number().finite().min(0).max(1) }).strict();
export const HookReel = z.object({ active: z.boolean() }).strict();
export const HookCancel = z.object({}).strict();

export interface HookLaunch {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/** Throw power from how long the button was held. */
export function hookPower(heldSeconds: number): number {
  return Math.min(1, Math.max(0, heldSeconds / HOOK.chargeSeconds));
}

/**
 * Launch point (right hand) and velocity for a throw from an eye position with the
 * player's look angles (yaw/pitch as in the movement code: yaw 0 looks along −Z).
 */
export function hookLaunch(
  eye: readonly [number, number, number],
  yaw: number,
  pitch: number,
  power: number,
): HookLaunch {
  const cp = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cp;
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * cp;
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const speed = HOOK.minSpeed + HOOK.extraSpeed * Math.min(1, Math.max(0, power));
  return {
    x: Math.fround(eye[0] + rx * 0.3 + dx * 0.4),
    y: Math.fround(eye[1] - 0.25 + dy * 0.4),
    z: Math.fround(eye[2] + rz * 0.3 + dz * 0.4),
    vx: Math.fround(dx * speed),
    vy: Math.fround(dy * speed + HOOK.liftSpeed),
    vz: Math.fround(dz * speed),
  };
}

/** Position `t` seconds after launch (rope caps horizontal travel). Writes into `out`. */
export function hookFlightPosition(
  l: HookLaunch,
  t: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const tt = Math.max(0, t);
  const h = Math.hypot(l.vx, l.vz);
  const tCap = h > 0 ? HOOK.maxRopeLength / h : Number.POSITIVE_INFINITY;
  const th = Math.min(tt, tCap);
  out[0] = l.x + l.vx * th;
  out[1] = l.y + l.vy * tt - 0.5 * HOOK.gravity * tt * tt;
  out[2] = l.z + l.vz * th;
  return out;
}

/** Time after launch at which the hook reaches the (flat) water surface. */
export function hookLandingTime(l: HookLaunch, surfaceY = WATER_LEVEL): number {
  const g = HOOK.gravity;
  const disc = l.vy * l.vy + 2 * g * (l.y - surfaceY);
  return disc <= 0 ? 0 : (l.vy + Math.sqrt(disc)) / g;
}
