/**
 * Interaction rules shared by client (prompt) and server (validation).
 * GAMEPLAY_SYSTEMS §A: client prompt range 2.5 m; the server accepts up to 3.0 m from
 * the SERVER position (0.5 m tolerance for prediction/latency), with line of sight.
 */
import { z } from "zod";
import { CHARACTER } from "./movement/constants";
import { LANTERN_HEIGHT, LANTERN_ID, LANTERN_POSITION } from "./world/raft";

export const INTERACT_RANGE = 2.5;
export const INTERACT_SERVER_RANGE = 3.0;

export const InteractUse = z.object({ targetId: z.string().regex(/^[a-z0-9-]{1,32}$/) }).strict();
export type InteractUse = z.infer<typeof InteractUse>;

export type InteractableKind = "lantern";

export interface InteractableDef {
  id: string;
  kind: InteractableKind;
  /** Target point in the raft frame (what the player must look at / be near). */
  point: readonly [number, number, number];
  /** Radius of the aim target (m). */
  radius: number;
}

export const INTERACTABLES: readonly InteractableDef[] = [
  {
    id: LANTERN_ID,
    kind: "lantern",
    point: [LANTERN_POSITION[0], LANTERN_POSITION[1] + LANTERN_HEIGHT, LANTERN_POSITION[2]],
    radius: 0.3,
  },
];

export function findInteractable(id: string): InteractableDef | undefined {
  return INTERACTABLES.find((i) => i.id === id);
}

/** Eye position of a character whose capsule center is (x, y, z). */
export function eyePosition(s: { x: number; y: number; z: number }): [number, number, number] {
  return [s.x, s.y + CHARACTER.eyeOffset, s.z];
}

export function distance3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
