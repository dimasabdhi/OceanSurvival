/**
 * PHASE 1 SPIKE protocol — validates Colyseus 0.18 APIs (schema builder, defineInput,
 * validate(zod), StateView). Not the final game protocol; replaced in Phase 2 by the
 * WorldRoom protocol documented in docs/MULTIPLAYER_DESIGN.md §9.
 */
import { type SchemaType, schema, t } from "@colyseus/schema";
import { z } from "zod";

export const SPIKE_ROOM_NAME = "spike";

/** Per-fixed-step input. Flat primitives only (Colyseus defineInput requirement). */
export const SpikeMoveInput = schema(
  {
    moveX: t.int8(),
    moveZ: t.int8(),
    yaw: t.float32(),
  },
  "SpikeMoveInput",
);
export type SpikeMoveInput = SchemaType<typeof SpikeMoveInput>;

export const SPIKE_MOVE_SPEED = 3.6; // m/s, GDD walk speed

/** Shared movement step (same function on client prediction and server). */
export function stepSpikeMovement(
  pos: { x: number; z: number; yaw: number },
  input: { moveX: number; moveZ: number; yaw: number },
  dt: number,
): void {
  const mx = Math.max(-1, Math.min(1, input.moveX));
  const mz = Math.max(-1, Math.min(1, input.moveZ));
  const len = Math.hypot(mx, mz);
  pos.yaw = input.yaw;
  if (len === 0) return;
  const nx = mx / len;
  const nz = mz / len;
  // Rotate local (strafe x, forward -z) by yaw around Y.
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  const wx = nx * cos + nz * sin;
  const wz = -nx * sin + nz * cos;
  pos.x += wx * SPIKE_MOVE_SPEED * dt;
  pos.z += wz * SPIKE_MOVE_SPEED * dt;
}

export const SpikeJoinOptions = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(24)
      .regex(/^[\p{L}\p{N} _-]+$/u, "name contains invalid characters"),
  })
  .strict();
export type SpikeJoinOptions = z.infer<typeof SpikeJoinOptions>;

export const SpikeChatMessage = z.object({ text: z.string().trim().min(1).max(200) }).strict();
export type SpikeChatMessage = z.infer<typeof SpikeChatMessage>;
