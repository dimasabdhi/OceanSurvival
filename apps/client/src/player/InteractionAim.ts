import {
  eyePosition,
  INTERACT_RANGE,
  INTERACTABLES,
  type InteractableDef,
} from "@oceansurvival/shared";

/**
 * Client-side aim test for interaction prompts (GAMEPLAY_SYSTEMS §A). Purely a UX hint:
 * the server re-validates range + line of sight with the SERVER position.
 * Works in the raft frame (unswayed), like the simulation.
 */
export function aimedInteractable(
  pose: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
): InteractableDef | null {
  const [ex, ey, ez] = eyePosition(pose);
  const cp = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cp;
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * cp;
  let best: InteractableDef | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const target of INTERACTABLES) {
    const vx = target.point[0] - ex;
    const vy = target.point[1] - ey;
    const vz = target.point[2] - ez;
    const t = vx * dx + vy * dy + vz * dz; // distance along the view ray
    if (t < 0 || t > INTERACT_RANGE) continue;
    const px = vx - dx * t;
    const py = vy - dy * t;
    const pz = vz - dz * t;
    // Slightly generous aim cone so small targets are easy to hit.
    if (Math.hypot(px, py, pz) <= target.radius + t * 0.05 && t < bestT) {
      best = target;
      bestT = t;
    }
  }
  return best;
}
